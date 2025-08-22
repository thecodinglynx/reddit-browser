// Simple proxy for Vercel serverless functions
// Usage: /api/proxy?url=<encoded target url>
export default async function handler(req, res) {
  try {
    const target = req.query.url || req.query.u;
    if (!target) {
      res.statusCode = 400;
      res.end("Missing url parameter\n");
      return;
    }

    const allowed = [
      "reddit.com",
      "www.reddit.com",
      "i.redd.it",
      "v.redd.it",
      "imgur.com",
      "i.imgur.com",
      "gfycat.com",
      "giant.gfycat.com",
      "media.giphy.com",
      "giphy.com",
      "i.redd.it",
      "i.redd.it",
    ];
    const u = new URL(target);
    const host = u.hostname.toLowerCase();
    const ok = allowed.some((a) => host === a || host.endsWith("." + a));
    if (!ok) {
      res.statusCode = 403;
      res.end("Host not allowed\n");
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
