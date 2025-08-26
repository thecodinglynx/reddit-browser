Netlify deployment notes for reddit-browser

Local dev with Netlify CLI

- Install Netlify CLI (recommended):

  npm install -g netlify-cli

- Run functions and the site locally (this respects Netlify.toml redirects):

  netlify dev

Build & deploy

- Build the site (Vite):

  npm run build

- Deploy (CLI):

  netlify deploy --prod --dir=dist

Notes & caveats

- Serverless execution limits: Netlify functions have execution time and memory limits which make proxying large or long video files risky.
- Reddit WAF/403: If you see 403 HTML blocks from reddit for function-hosted requests, consider moving the proxy to a VPS or Cloudflare Worker, or using an authenticated Reddit API server.
- Binary responses: The function returns images/videos base64-encoded with the proper response headers; your client code should continue calling `/api/proxy?url=...`.
