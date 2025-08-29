// Simple proxy for Vercel serverless functions
// Usage: /api/proxy?url=<encoded target url>
export default async function handler(req, res) {
  // Load local .env into process.env when running the dev proxy (no deps)
  try {
    // support a simple password check for app unlock: /api/proxy?_action=check_password
    if (req.query && req.query._action === "check_password") {
      const provided = req.headers["x-app-password"] || null;
      const expected = process.env.APP_PASSWORD || null;
      if (!expected) {
        res.statusCode = 501;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            success: false,
            message: "APP_PASSWORD not configured on server",
          })
        );
        return;
      }
      if (provided === expected) {
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ success: true }));
        return;
      }
      res.statusCode = 403;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: false, message: "invalid password" }));
      return;
    }
    const fs = await import("fs");
    const path = await import("path");
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, "utf8");
      raw.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) {
          let val = m[2];
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          process.env[m[1]] = process.env[m[1]] || val;
        }
      });
    }
  } catch (e) {
    /* ignore */
  }
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

    // We do not perform any server-side OAuth or app-token exchange here.
    // The proxy will forward an Authorization header sent by the client, if present,
    // but will not attach or fetch any server-side tokens.

    // diagnostic: log outgoing request target and header summary (no secrets)
    try {
      console.log("proxy -> fetch", {
        target,
        hasAuth: Boolean(forwardHeaders["Authorization"]),
        userAgent: forwardHeaders["User-Agent"] ? true : false,
      });
    } catch (e) {}

    const r = await fetch(target, { headers: forwardHeaders });

    // if remote returned non-OK, capture a short snippet and headers for logs
    if (!r.ok) {
      try {
        const txt = await r
          .clone()
          .text()
          .catch(() => "");
        // collect response headers into an array for structured logs
        let headersArray = [];
        try {
          headersArray = Array.from(r.headers.entries());
        } catch (e) {
          // ignore header collection errors
        }
        console.warn("proxy remote non-ok", {
          status: r.status,
          headers: headersArray,
          snippet: txt.slice(0, 2000),
        });

        // helpful debugging: when ?debug=1 is present, return the remote snippet
        // directly so we can inspect the HTML/body from the deployed function.
        if (
          req.query &&
          (req.query.debug === "1" || req.query.debug === "true")
        ) {
          res.statusCode = r.status;
          // return plain text so curl/clients can read the snippet easily
          res.setHeader("content-type", "text/plain; charset=utf-8");
          const out = `REMOTE_STATUS: ${r.status}\n\n${txt.slice(0, 5000)}`;
          res.end(out);
          return;
        }
      } catch (e) {
        // ignore logging/errors during diagnostics
      }
    }

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
