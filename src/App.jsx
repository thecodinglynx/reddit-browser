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
  const [loading, setLoading] = useState(false);
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
        const res = await fetch(
          `https://corsproxy.io/?https://www.reddit.com/r/${subreddit}/hot.json?limit=50`
        );
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        const posts = data.data?.children || [];
        const imgs = posts
          .map((p) => p.data)
          .filter((d) => d.post_hint === "image" && d.url)
          .map((d) => ({
            url: d.url,
            title: d.title,
            permalink: d.permalink,
          }));
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
        {!loading && !fetchError && images.length > 0 && (
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
