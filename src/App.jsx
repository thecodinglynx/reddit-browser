import { useEffect, useRef, useState } from "react";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./App.css";

const DEFAULT_SUBREDDIT = "EarthPorn";
const DEFAULT_INTERVAL = 120;

function App() {
  const subredditInputRef = useRef(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [subreddit, setSubreddit] = useState(DEFAULT_SUBREDDIT);
  const [subredditInput, setSubredditInput] = useState(DEFAULT_SUBREDDIT);
  const [intervalSec, setIntervalSec] = useState(DEFAULT_INTERVAL);
  const [showConfig, setShowConfig] = useState(false);
  const [redditToken, setRedditToken] = useState(() => {
    try {
      return localStorage.getItem("redditToken") || "";
    } catch (e) {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [redditClientId, setRedditClientId] = useState("");
  const [redditClientSecret, setRedditClientSecret] = useState("");
  const [images, setImages] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef();

  // Debounce subreddit input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (subredditInput !== subreddit) {
        setSubreddit(subredditInput);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [subredditInput]);

  // persist reddit token to localStorage
  useEffect(() => {
    try {
      if (redditToken) localStorage.setItem("redditToken", redditToken);
      else localStorage.removeItem("redditToken");
    } catch (e) {
      // ignore
    }
  }, [redditToken]);

  // load runtime config from public/config.json (if present)
  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const res = await fetch("/config.json");
        if (!res.ok) return;
        const cfg = await res.json();
        if (cancelled) return;
        if (cfg.redditClientId) setRedditClientId(cfg.redditClientId);
        if (cfg.redditClientSecret)
          setRedditClientSecret(cfg.redditClientSecret);
      } catch (e) {
        // ignore
      }
    }
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Image cycling effect
  useEffect(() => {
    if (images.length === 0) return;
    setCurrentIdx(0);
    setProgress(0);
    clearInterval(timerRef.current);
    const intervalMs = 100;
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          setCurrentIdx((idx) => (idx + 1) % images.length);
          return 0;
        }
        return prev + intervalMs / 1000 / intervalSec;
      });
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [images, intervalSec]);
  useEffect(() => {
    async function fetchImages() {
      setLoading(true);
      setFetchError(false);
      try {
        const url = `https://corsproxy.io/?https://www.reddit.com/r/${subreddit}/hot.json?limit=50`;
        const headers = {};
        if (redditToken) {
          headers["Authorization"] = `Bearer ${redditToken}`;
        }
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        const posts = data.data?.children || [];
        const imgs = posts
          .map((p) => p.data)
          .map((d) => {
            if (!d || !d.url) return null;
            const rawUrl = d.url;
            const lower = rawUrl.toLowerCase();
            // normalize preview urls
            const maybePreview =
              d.preview &&
              d.preview.images &&
              d.preview.images[0] &&
              d.preview.images[0].source &&
              d.preview.images[0].source.url
                ? d.preview.images[0].source.url.replace(/&amp;/g, "&")
                : null;

            // reddit-hosted video (v.redd.it)
            if (
              d.is_video &&
              d.media &&
              d.media.reddit_video &&
              d.media.reddit_video.fallback_url
            ) {
              return {
                type: "video",
                url: d.media.reddit_video.fallback_url,
                poster: maybePreview || d.thumbnail || null,
                title: d.title,
                permalink: d.permalink,
              };
            }

            // gifv -> mp4
            if (lower.endsWith(".gifv")) {
              return {
                type: "video",
                url: rawUrl.replace(/\.gifv$/i, ".mp4"),
                poster: maybePreview || d.thumbnail || null,
                title: d.title,
                permalink: d.permalink,
              };
            }

            // direct video files
            if (lower.endsWith(".mp4") || lower.endsWith(".webm")) {
              return {
                type: "video",
                url: rawUrl,
                poster: maybePreview || d.thumbnail || null,
                title: d.title,
                permalink: d.permalink,
              };
            }

            // animated gif - use img (browser will animate)
            if (lower.endsWith(".gif")) {
              return {
                type: "image",
                url: rawUrl,
                title: d.title,
                permalink: d.permalink,
              };
            }

            // normal images (and preview fallback)
            if (d.post_hint === "image" || maybePreview) {
              return {
                type: "image",
                url: maybePreview || rawUrl,
                title: d.title,
                permalink: d.permalink,
              };
            }

            // otherwise skip
            return null;
          })
          .filter(Boolean);
        setImages(imgs);
      } catch (e) {
        setImages([]);
        setFetchError(true);
      }
      setLoading(false);
      setHasFetched(true);
    }
    fetchImages();
  }, [subreddit]);
  return (
    <>
      <div className="reddit-browser">
        {/* Modal for config */}
        {showConfig && (
          <div className="modal-overlay" onClick={() => setShowConfig(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <form className="config-form">
                <div className="form-row">
                  <label htmlFor="subreddit">Subreddit</label>
                  <input
                    name="subreddit"
                    id="subreddit"
                    ref={subredditInputRef}
                    value={subredditInput}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSubredditInput(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="redditToken">
                    Reddit access token (optional)
                  </label>
                  <input
                    name="redditToken"
                    id="redditToken"
                    value={redditToken}
                    placeholder="Paste OAuth access token here"
                    onChange={(e) => setRedditToken(e.target.value)}
                  />
                  <small style={{ color: "#666" }}>
                    Optional: paste a Reddit OAuth access token to increase rate
                    limits. For security, prefer using a server-side proxy.
                  </small>
                </div>
                {/* client id/secret are loaded from /config.json and are not editable in the UI */}
                <div className="form-row">
                  <label htmlFor="interval">Interval (seconds)</label>
                  <div className="slider-row">
                    <input
                      name="interval"
                      id="interval"
                      type="range"
                      min="5"
                      max="300"
                      value={intervalSec}
                      step="1"
                      onChange={(e) => setIntervalSec(Number(e.target.value))}
                    />
                    <span className="slider-value">{intervalSec}s</span>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowConfig(false)}
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div
          className="progress-bar-row"
          style={{ display: "flex", alignItems: "center" }}
        >
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progress * 100}%` }}
            ></div>
          </div>
          <span
            className="progress-seconds"
            style={{ marginLeft: 10, fontSize: "0.9em", color: "#888" }}
          >
            {Math.ceil(intervalSec - progress * intervalSec)}s
          </span>
          <button
            className="cog-btn"
            title="Settings"
            onClick={() => setShowConfig((v) => !v)}
            style={{ marginLeft: "10px" }}
          >
            <i
              className="fa-solid fa-gear"
              style={{ fontSize: "28px", color: "#888" }}
            ></i>
          </button>
        </div>
        {!loading && !fetchError && images.length > 0 && images[currentIdx] && (
          <div className="image-viewer">
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "16px",
                marginBottom: "8px",
              }}
            >
              <a
                href={`https://reddit.com${images[currentIdx].permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1 }}
              >
                {images[currentIdx].type === "video" ? (
                  <video
                    className="main-image"
                    src={images[currentIdx].url}
                    poster={images[currentIdx].poster}
                    muted
                    autoPlay
                    loop
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <img
                    src={images[currentIdx].url}
                    alt={images[currentIdx].title}
                    className="main-image"
                    style={{
                      objectFit: "contain",
                      width: "100%",
                      height: "100%",
                    }}
                  />
                )}
              </a>
            </div>
            <p style={{ textAlign: "center" }}>{images[currentIdx].title}</p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "32px",
                marginTop: "12px",
              }}
            >
              <button
                type="button"
                className="nav-btn"
                aria-label="Previous image"
                onClick={() => {
                  setCurrentIdx(
                    (idx) => (idx - 1 + images.length) % images.length
                  );
                  setProgress(0);
                }}
                style={{ fontSize: "1.5em", padding: "8px 24px" }}
                disabled={images.length === 0}
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <button
                type="button"
                className="nav-btn"
                aria-label="Next image"
                onClick={() => {
                  setCurrentIdx((idx) => (idx + 1) % images.length);
                  setProgress(0);
                }}
                style={{ fontSize: "1.5em", padding: "8px 24px" }}
                disabled={images.length === 0}
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
        {!loading && hasFetched && (images.length === 0 || fetchError) && (
          <div className="error-container">
            <img
              src="/error.png"
              alt="Subreddit not found"
              className="error-image"
            />
            <h2>Subreddit "{subreddit}" could not be found</h2>
            <p>
              {fetchError
                ? "Network error or Reddit API unavailable. Please try again."
                : "Please check the name and try again."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
