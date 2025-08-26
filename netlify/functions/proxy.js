// Netlify function proxy for reddit-browser
// Exports `handler` compatible with Netlify Functions (Node 18+ global fetch available)
const ALLOWED_HOSTS = new Set([
  "www.reddit.com",
  "reddit.com",
  "old.reddit.com",
  "r.jina.ai",
  "i.redd.it",
  "v.redd.it",
  "i.reddituploads.com",
  "external-preview.redd.it",
  "preview.redd.it",
  "imgur.com",
  "i.imgur.com",
  "gfycat.com",
  "giant.gfycat.com",
  "redgifs.com",
  "cdn.redgifs.com",
  "streamable.com",
  "media.giphy.com",
]);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

exports.handler = async function (event, context) {
  const qs = event.queryStringParameters || {};
  const target = qs.url;
  const debug = qs.debug === "1" || qs.debug === "true";

  if (!target) return { statusCode: 400, body: "missing url query parameter" };

  let parsed;
  try {
    parsed = new URL(target);
  } catch (err) {
    return { statusCode: 400, body: "invalid url" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return { statusCode: 403, body: `host not allowed: ${hostname}` };
  }

  // Build outgoing headers, forward Authorization if present, and prefer client's UA
  const incomingHeaders = event.headers || {};
  const outgoing = {
    accept: incomingHeaders["accept"] || "*/*",
    "user-agent":
      incomingHeaders["user-agent"] || "reddit-browser-netlify-proxy",
  };
  if (incomingHeaders.authorization)
    outgoing.authorization = incomingHeaders.authorization;

  try {
    const remote = await fetch(target, { method: "GET", headers: outgoing });

    // Collect headers to return, filter hop-by-hop
    const responseHeaders = {};
    remote.headers.forEach((v, k) => {
      if (!HOP_BY_HOP.has(k.toLowerCase())) responseHeaders[k] = v;
    });

    const contentType = remote.headers.get("content-type") || "";
    const isBinary =
      /^(image|video|audio)\//i.test(contentType) ||
      (remote.headers.get("content-disposition") || "").includes("attachment");

    // If debug mode requested and remote returned non-OK, return snippet as text for diagnosis
    if (debug) {
      const txt = await remote.text();
      return {
        statusCode: remote.status,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: txt.slice(0, 64 * 1024),
      };
    }

    // Read body
    const arrayBuffer = await remote.arrayBuffer();
    let body;
    let isBase64Encoded = false;
    if (isBinary) {
      body = Buffer.from(arrayBuffer).toString("base64");
      isBase64Encoded = true;
    } else {
      body = Buffer.from(arrayBuffer).toString("utf8");
    }

    // Optionally add caching for media
    if (
      remote.ok &&
      (contentType.startsWith("image/") || contentType.startsWith("video/"))
    ) {
      responseHeaders["cache-control"] =
        responseHeaders["cache-control"] || "public, max-age=3600";
    }

    return {
      statusCode: remote.status,
      headers: responseHeaders,
      body,
      isBase64Encoded,
    };
  } catch (err) {
    return { statusCode: 502, body: "proxy fetch error: " + String(err) };
  }
};
