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

    // forward Authorization header if present and ensure we send a sensible User-Agent
    // Reddit rejects some requests without a proper User-Agent header; prefer the client's UA
    const forwardHeaders = {};
    if (req.headers && req.headers.authorization) {
      forwardHeaders["Authorization"] = req.headers.authorization;
    }
    // Use the incoming request's User-Agent when available, otherwise a descriptive fallback
    try {
      forwardHeaders["User-Agent"] =
        (req.headers && req.headers["user-agent"]) ||
        "reddit-browser/1.0 (by reddit-browser-app)";
    } catch (e) {}
    // provide a permissive Accept header if the client didn't set one
    try {
      forwardHeaders["Accept"] =
        (req.headers && req.headers["accept"]) || "*/*";
    } catch (e) {}

    // If no Authorization was provided by the client, and the server has
    // Reddit credentials in env, obtain an app-only token and attach it.
    // This keeps secrets on the server and lets the server call OAuth endpoints
    // on behalf of the app without exposing client_secret to the browser.
    async function getAppToken() {
      // simple in-memory cache
      if (!global.__redditTokenCache) global.__redditTokenCache = {};
      const cache = global.__redditTokenCache;
      const now = Date.now();
      if (cache.token && cache.expiresAt && now < cache.expiresAt - 60000) {
        return cache.token;
      }

      const clientId = process.env.REDDIT_CLIENT_ID;
      const clientSecret = process.env.REDDIT_CLIENT_SECRET;
      const deviceId = process.env.REDDIT_DEVICE_ID; // optional for installed_client
      if (!clientId) return null;

      let bodyParams;
      let authHeader;
      if (clientSecret) {
        // confidential client: client_credentials grant
        bodyParams = new URLSearchParams({ grant_type: "client_credentials" });
        authHeader =
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      } else if (deviceId) {
        // installed client flow
        bodyParams = new URLSearchParams({
          grant_type: "https://oauth.reddit.com/grants/installed_client",
          device_id: deviceId,
        });
        authHeader = "Basic " + Buffer.from(`${clientId}:`).toString("base64");
      } else {
        return null;
      }

      try {
        const tokenResp = await fetch(
          "https://www.reddit.com/api/v1/access_token",
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "reddit-browser/1.0 by reddit-browser-app",
            },
            body: bodyParams.toString(),
          }
        );
        if (!tokenResp.ok) {
          const txt = await tokenResp.text().catch(() => "");
          console.warn("reddit token fetch failed", tokenResp.status, txt);
          return null;
        }
        const data = await tokenResp.json();
        if (data && data.access_token) {
          cache.token = data.access_token;
          cache.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          return cache.token;
        }
      } catch (e) {
        console.warn("reddit token fetch error", e && e.message);
      }
      return null;
    }

    // If client didn't send Authorization, try to get a server-side token
    if (!forwardHeaders["Authorization"]) {
      const appToken = await getAppToken();
      if (appToken) {
        forwardHeaders["Authorization"] = `bearer ${appToken}`;
        // if target is reddit.com, prefer oauth.reddit.com when using a bearer token
        try {
          const u2 = new URL(target);
          if (
            u2.hostname &&
            u2.hostname.endsWith("reddit.com") &&
            !u2.hostname.startsWith("oauth.")
          ) {
            u2.hostname = "oauth.reddit.com";
            target = u2.toString();
          }
        } catch (e) {
          // ignore URL parsing errors here
        }
      }
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
