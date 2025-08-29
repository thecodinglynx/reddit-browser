const functions = require("firebase-functions");

// Allowed hosts list - adapted from repo
const ALLOWED = new Set([
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

exports.proxy = functions.https.onRequest(async (req, res) => {
  try {
    // support server-side password check: /api/proxy?_action=check_password
    if (req.query && req.query._action === "check_password") {
      // prefer functions.config().app.password in production
      let expected = null;
      try {
        const cfg = functions.config && functions.config().app;
        if (cfg && cfg.password) expected = cfg.password;
      } catch (e) {}
      if (!expected) expected = process.env.APP_PASSWORD || null;
      const provided = req.headers["x-app-password"] || null;
      if (!expected) {
        res
          .status(501)
          .send({
            success: false,
            message: "APP password not configured on server",
          });
        return;
      }
      if (provided === expected) {
        res.status(200).send({ success: true });
        return;
      }
      res.status(403).send({ success: false, message: "invalid password" });
      return;
    }
    // reCAPTCHA verification removed
    const raw = req.query.url || req.query.u;
    if (!raw) {
      res.status(400).send("Missing url parameter\n");
      return;
    }
    let target;
    try {
      target = decodeURIComponent(raw);
    } catch (e) {
      target = raw;
    }
    let u;
    try {
      u = new URL(target);
    } catch (e) {
      res.status(400).send("Invalid target URL\n");
      return;
    }
    const host = u.hostname.toLowerCase();
    console.log("Proxy target:", target);
    console.log("Proxy host:", host);
    const ok = Array.from(ALLOWED).some(
      (a) => host === a || host.endsWith("." + a)
    );
    if (!ok) {
      console.warn("Host not allowed, rejecting request for", host);
      res.status(403).send(`Host not allowed: ${host}\n`);
      return;
    }

    const forwardHeaders = {};
    if (req.headers && req.headers.authorization) {
      forwardHeaders["Authorization"] = req.headers.authorization;
    }
    // Use a realistic browser User-Agent by default; some sites (including Reddit)
    // block requests with non-browser UAs or suspicious agent strings.
    forwardHeaders["User-Agent"] =
      (req.headers && req.headers["user-agent"]) ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";
    forwardHeaders["Accept"] = (req.headers && req.headers["accept"]) || "*/*";
    // Add common browser headers which can help avoid remote blocks
    if (!(req.headers && req.headers["accept-language"])) {
      forwardHeaders["Accept-Language"] = "en-US,en;q=0.9";
    }
    // Set Referer to the target origin unless the client provided one
    if (!(req.headers && req.headers["referer"])) {
      try {
        forwardHeaders["Referer"] = u.origin;
      } catch (e) {
        /* ignore */
      }
    }

    // If the request is going to reddit, attempt to obtain a server-side
    // app-only OAuth token (client credentials) and attach it. The code
    // reads credentials from functions.config().reddit or from
    // process.env.REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET. If no creds are
    // available, it will proceed unauthenticated.
    async function getRedditCredentials() {
      try {
        const cfg = functions.config && functions.config().reddit;
        const id = (cfg && cfg.client_id) || process.env.REDDIT_CLIENT_ID;
        const secret =
          (cfg && cfg.client_secret) || process.env.REDDIT_CLIENT_SECRET;
        if (id && secret) return { id, secret };
      } catch (e) {
        // ignore
      }
      return null;
    }

    // Module-level token cache (keeps across invocations in warm instances)
    if (!global.__reddit_oauth) global.__reddit_oauth = { token: null, exp: 0 };

    async function fetchRedditTokenIfNeeded() {
      const now = Date.now();
      if (
        global.__reddit_oauth.token &&
        global.__reddit_oauth.exp - 60000 > now
      ) {
        return global.__reddit_oauth.token;
      }
      const cfg = functions.config && functions.config().reddit;
      const id = (cfg && cfg.client_id) || process.env.REDDIT_CLIENT_ID;
      const secret =
        (cfg && cfg.client_secret) || process.env.REDDIT_CLIENT_SECRET;
      const username = (cfg && cfg.username) || process.env.REDDIT_USERNAME;
      const password = (cfg && cfg.password) || process.env.REDDIT_PASSWORD;
      if (!id || !secret) {
        console.log("No reddit client_id/secret configured");
        return null;
      }
      try {
        const b64 = Buffer.from(`${id}:${secret}`).toString("base64");
        // Prefer a Reddit-style User-Agent. If a service username is present,
        // include it in the UA as required by Reddit's API rules.
        const redditUserAgent = username
          ? `script:reddit-browser:1.0 (by /u/${username})`
          : "RedditBrowser/1.0 (by /u/yourusername)";
        let tokenRes;
        if (username && password) {
          // Use password grant (script app). This requires a reddit account's
          // username and password stored in config or env. Scope 'read' is
          // sufficient for listing endpoints.
          const body = `grant_type=password&username=${encodeURIComponent(
            username
          )}&password=${encodeURIComponent(password)}&scope=read`;
          console.log(
            "Requesting reddit token using password grant for user",
            username
          );
          tokenRes = await (global.fetch || fetch)(
            "https://www.reddit.com/api/v1/access_token",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${b64}`,
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": redditUserAgent,
              },
              body,
            }
          );
        } else {
          // Fallback to client_credentials (app-only) grant
          console.log("Requesting reddit token using client_credentials grant");
          tokenRes = await (global.fetch || fetch)(
            "https://www.reddit.com/api/v1/access_token",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${b64}`,
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": redditUserAgent,
              },
              body: "grant_type=client_credentials",
            }
          );
        }
        if (!tokenRes.ok) {
          const t = await tokenRes.text().catch(() => "");
          console.warn(
            "Failed to fetch reddit token:",
            tokenRes.status,
            t.slice(0, 200)
          );
          return null;
        }
        const j = await tokenRes.json();
        if (j && j.access_token && j.expires_in) {
          global.__reddit_oauth.token = j.access_token;
          global.__reddit_oauth.exp =
            Date.now() + (j.expires_in || 3600) * 1000;
          console.log("Fetched new reddit token, expires_in=", j.expires_in);
          return global.__reddit_oauth.token;
        }
      } catch (e) {
        console.warn("Error fetching reddit token", e && e.message);
        return null;
      }
      return null;
    }

    // If target is reddit, attempt to fetch token and override Authorization.
    // When making OAuth-authorized requests to Reddit, the request should go
    // to oauth.reddit.com. If we have a token, rewrite the fetch URL and set
    // a Reddit-friendly User-Agent.
    let fetchUrl = target;
    if (
      host === "www.reddit.com" ||
      host === "reddit.com" ||
      host === "old.reddit.com"
    ) {
      const token = await fetchRedditTokenIfNeeded();
      if (token) {
        forwardHeaders["Authorization"] = `Bearer ${token}`;
        try {
          const pathAndQuery = `${u.pathname}${u.search || ""}`;
          fetchUrl = `https://oauth.reddit.com${pathAndQuery}`;
          // Use the reddit-style UA we used when fetching the token (if any).
          forwardHeaders["User-Agent"] =
            (req.headers && req.headers["user-agent"]) ||
            (username
              ? `script:reddit-browser:1.0 (by /u/${username})`
              : "RedditBrowser/1.0 (by /u/yourusername)");
        } catch (e) {
          console.warn(
            "Failed to rewrite to oauth.reddit.com, using original target",
            e && e.message
          );
        }
        // Optional debug: call /api/v1/me to confirm token identity when ?debug=1
        if (
          req.query &&
          (req.query.debug === "1" || req.query.debug === "true")
        ) {
          try {
            const meRes = await (global.fetch || fetch)(
              "https://oauth.reddit.com/api/v1/me",
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "User-Agent": forwardHeaders["User-Agent"],
                  Accept: "application/json",
                },
              }
            );
            const meText = await meRes.text().catch(() => "");
            console.log(
              "Reddit /api/v1/me status:",
              meRes.status,
              "body-trim:",
              meText.slice(0, 1000)
            );
          } catch (e) {
            console.warn("Error fetching /api/v1/me for debug", e && e.message);
          }
        }
      } else {
        console.log("No reddit token available, proceeding unauthenticated");
      }
    }

    // Firebase Functions Node runtimes provide global fetch; use it when available.
    const r = await (global.fetch || fetch)(fetchUrl, {
      headers: forwardHeaders,
    });
    console.log("Remote response status:", r.status);

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.warn(
        "Remote fetch returned non-ok",
        r.status,
        "body-trim:",
        txt.slice(0, 200)
      );
      // Always forward a short plaintext explanation so clients see the remote status
      res
        .status(r.status)
        .type("text/plain")
        .send(`REMOTE_STATUS: ${r.status}\n\n${txt.slice(0, 5000)}`);
      return;
    }

    const arrayBuffer = await r.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ct = r.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("cache-control", "public, max-age=3600");
    res.status(r.status).send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error\n");
  }
});
