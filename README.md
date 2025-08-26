# Reddit Browser

A small Progressive Web App (React + Vite) that fetches images and animated media from a subreddit and cycles through them on a configurable interval.

## Features

- Shows images, animated GIFs and Reddit-hosted videos (v.redd.it / gifv -> mp4 / mp4 / webm).
- Automatic slideshow with configurable interval and a fluid progress bar.
- Manual forward/back controls.
- Settings modal for subreddit and interval.
- Optional: paste a Reddit OAuth access token (Bearer) to increase rate limits.
- Mobile-friendly responsive layout and PWA-ready manifest/service worker (when present).

## Quick start (development)

1. Install dependencies:

```powershell
cd <repo-root>
npm install
```

2. Start dev server:

```powershell
cd <repo-root>
npm run dev
```

3. Open the local dev URL shown by Vite in your browser or device.

### Start both the proxy and the UI (LAN-accessible)

If you want to run the local proxy and the Vite dev server together and expose the UI to other machines on your network, use:

```powershell
npx concurrently "npm run start:proxy" "npm run dev -- --host 0.0.0.0"
```

This starts the proxy on port 3000 and the Vite dev server on port 5173 and binds Vite to all interfaces so other devices on the same LAN can reach the app at `http://<your-ip>:5173`.

## Build for production

```powershell
npm run build
npm run preview
```

## Configuration and secrets

## Safer alternative (recommended)

- Store secrets on a server or serverless function and proxy Reddit requests. The server keeps client id/secret in environment variables and exchanges them for OAuth tokens. The frontend then calls your server's endpoint (e.g. `/api/reddit/:subreddit/hot`) instead of calling Reddit directly.

## Optional access token

- In Settings you can paste a Reddit OAuth access token. The app will include it as a Bearer token on Reddit requests to increase rate limits. This token is stored in `localStorage` on the client and is only appropriate for short-term/local use.

## Supported media types

- Images (.jpg/.png/.jpeg)
- Animated GIFs (.gif)
- Reddit-hosted videos (v.redd.it) and direct .mp4/.webm files — played via the HTML `<video>` element (autoplay muted loop) when supported.

## Troubleshooting

- If images don't load due to CORS, the project currently uses a CORS proxy for development. For reliable production usage, use a server proxy or host properly.
- If videos do not autoplay on mobile, user agent/autoplay policies may prevent it; videos are muted and use `playsInline` to improve compatibility.

## Development notes

- The main app source is `src/App.jsx` and styles are in `src/App.css`.
- The app uses Font Awesome icons via the included CSS import.

## Contributing

- Feel free to open issues or PRs. Keep secrets out of commits. Use `public/config.example.json` or environment variables for examples.

## License

- MIT

If you want, I can scaffold a tiny server proxy (Express server) and update the frontend to call it. Which would you prefer?
