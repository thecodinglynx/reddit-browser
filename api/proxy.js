// Simple proxy for Vercel serverless functions
// Usage: /api/proxy?url=<encoded target url>
export default async function handler(req, res) {
  try {
    const raw = req.query.url || req.query.u;
    if (!raw) {
      res.statusCode = 400;
      res.end("Missing url parameter\n");
      return;
    }
    // query param may be encoded
    let target;
    try {
      target = decodeURIComponent(raw);
    } catch (e) {
      target = raw;
    }

    const allowed = [
      "reddit.com",
      "redd.it",
      "imgur.com",
      "gfycat.com",
      "giphy.com",
      "redgifs.com",
      "streamable.com",
      "tenor.com",
    ];
    let u;
    try {
      u = new URL(target);
    } catch (e) {
      res.statusCode = 400;
      res.end("Invalid target URL\n");
      return;
    }
    const host = u.hostname.toLowerCase();
    const ok = allowed.some((a) => host === a || host.endsWith("." + a));
    console.log("proxy request", {
      target,
      host,
      ok,
      from:
        req.headers.origin ||
        req.headers.referer ||
        req.connection.remoteAddress,
    });
    if (!ok) {
      res.statusCode = 403;
      res.end(`Host not allowed: ${host}\n`);
      return;
    }

    // forward Authorization header if present
    const forwardHeaders = {};
    if (req.headers && req.headers.authorization) {
      forwardHeaders["Authorization"] = req.headers.authorization;
    }

    const r = await fetch(target, { headers: forwardHeaders });

    // stream the body back
    const arrayBuffer = await r.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.statusCode = r.status;
    const ct = r.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    // allow cross-origin for media consumption
    res.setHeader("access-control-allow-origin", "*");
    // cache for a short time
    res.setHeader("cache-control", "public, max-age=3600");
    res.end(buffer);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("Proxy error\n");
  }
}
