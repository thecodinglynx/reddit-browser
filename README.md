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

````powershell
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
````

2. Start dev server:

```powershell
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

## Deploying to Firebase

This project uses Firebase Hosting with a rewrite that forwards `/api/**` to a Cloud Function named `proxy`. Follow these steps to deploy or update the app on Firebase.

Prerequisites

- Install the Firebase CLI and log in:

```powershell
npm install -g firebase-tools
firebase login
```

- Select or create a Firebase project. Note the project ID (example: `redslide-7c299`).

1. Build the frontend assets

```powershell
npm run build
```

2. (Optional) Set Reddit credentials in functions config

If you use the server-side Reddit token flow, store credentials in Firebase functions config. Use single quotes to avoid PowerShell expansion of `$`:

```powershell
npx firebase functions:config:set `
	reddit.client_id='YOUR_CLIENT_ID' `
	reddit.client_secret='YOUR_CLIENT_SECRET' `
	reddit.username='SERVICE_USERNAME' `
	reddit.password='SERVICE_PASSWORD' `
	--project your-project-id
```

Note: For production, consider using Secret Manager instead of `functions.config()` for sensitive values.

3. Deploy hosting and functions

```powershell
npx firebase deploy --only hosting,functions --project your-project-id
```

4. Test the hosted site and proxy

- Hosted site: `https://<your-project-id>.web.app` or `https://<your-project-id>.firebaseapp.com`
- Test proxy (debug mode shows token `/api/v1/me` logs):

```powershell
curl.exe "https://<your-project-id>.web.app/api/proxy?url=https%3A%2F%2Fwww.reddit.com%2Fr%2Fjokes%2Ftop.json%3Flimit%3D1&debug=1" -i
```

Check function logs if debugging is needed:

```powershell
npx firebase functions:log --only proxy --project your-project-id
```

## Configuration and secrets

- `functions/config()` is used in the Cloud Function to read `reddit.client_id`, `reddit.client_secret`, `reddit.username`, and `reddit.password` when present.
- For stronger security, use Google Cloud Secret Manager and reference secrets from Cloud Functions.

## Optional access token

- In Settings you can paste a Reddit OAuth access token. The app will include it as a Bearer token on Reddit requests to increase rate limits. This token is stored in `localStorage` on the client and is only appropriate for short-term/local use.

## Supported media types

- Images (.jpg/.png/.jpeg)
- Animated GIFs (.gif)
- Reddit-hosted videos (v.redd.it) and direct .mp4/.webm files — played via the HTML `<video>` element (autoplay muted loop) when supported.

## Troubleshooting

- If you get a 403 from Reddit in production:

  - Confirm the Reddit `script` app and service account are valid (no 2FA, not suspended).
  - Verify credentials by requesting a token locally (see README earlier steps).
  - If token requests work locally but 403 occurs in Cloud Functions, try redeploying or use a different service account; sometimes IP-based blocks affect hosted environments.

- If images don't load due to CORS, the project uses a server proxy for production.

## Development notes

- The main app source is `src/App.jsx` and styles are in `src/App.css`.
- The proxy Cloud Function is in `functions/index.js`.

## Contributing

- Feel free to open issues or PRs. Keep secrets out of commits.

## License

- MIT
