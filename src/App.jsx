import { useEffect, useRef, useState } from "react";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./App.css";
import ProgressBar from "./components/ProgressBar";
import ConfigModal from "./components/ConfigModal";
import ImageViewer from "./components/ImageViewer";

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
  const [seen, setSeen] = useState(() => {
    try {
      const arr = JSON.parse(localStorage.getItem("seenPosts") || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  });
  const [fetchTrigger, setFetchTrigger] = useState(0);
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
        // filter out already-seen items (identified by permalink or url)
        const filtered = imgs.filter((i) => {
          const id = i.permalink || i.url;
          return id ? !seen.has(id) : true;
        });
        setImages(filtered);
      } catch (e) {
        setImages([]);
        setFetchError(true);
      }
      setLoading(false);
      setHasFetched(true);
    }
    fetchImages();
  }, [subreddit, fetchTrigger, redditToken]);

  // when the currently-displayed image changes, mark it as seen (persist)
  useEffect(() => {
    if (!images || images.length === 0) return;
    const current = images[currentIdx];
    if (!current) return;
    const id = current.permalink || current.url;
    if (!id) return;
    if (seen.has(id)) return;
    try {
      setSeen((prev) => {
        const next = new Set(prev);
        next.add(id);
        try {
          localStorage.setItem("seenPosts", JSON.stringify([...next]));
        } catch (e) {
          // ignore
        }
        return next;
      });
    } catch (e) {
      // ignore
    }
  }, [currentIdx, images]);
  return (
    <>
      <div className="reddit-browser">
        {/* Modal for config */}
        {showConfig && (
          <ConfigModal
            subredditInputRef={subredditInputRef}
            subredditInput={subredditInput}
            setSubredditInput={setSubredditInput}
            redditToken={redditToken}
            setRedditToken={setRedditToken}
            intervalSec={intervalSec}
            setIntervalSec={setIntervalSec}
            onClose={() => setShowConfig(false)}
            onClearSeen={() => {
              try {
                localStorage.removeItem("seenPosts");
              } catch (e) {}
              setSeen(new Set());
              // bump trigger to force refetch and repopulate images
              setFetchTrigger((v) => v + 1);
            }}
          />
        )}

        <ProgressBar
          progress={progress}
          intervalSec={intervalSec}
          onToggleConfig={() => setShowConfig((v) => !v)}
        />

        {!loading && !fetchError && images.length > 0 && images[currentIdx] && (
          <ImageViewer
            images={images}
            currentIdx={currentIdx}
            setCurrentIdx={setCurrentIdx}
            setProgress={setProgress}
          />
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
