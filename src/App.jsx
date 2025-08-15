import { useEffect, useRef, useState } from "react";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./App.css";

const DEFAULT_SUBREDDIT = "EarthPorn";
const DEFAULT_INTERVAL = 30;

function App() {
  const [hasFetched, setHasFetched] = useState(false);
  const [subreddit, setSubreddit] = useState(DEFAULT_SUBREDDIT);
  const [subredditInput, setSubredditInput] = useState(DEFAULT_SUBREDDIT);
  const [intervalSec, setIntervalSec] = useState(DEFAULT_INTERVAL);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef();

  // Image cycling effect
  useEffect(() => {
    if (images.length === 0) return;
    setCurrentIdx(0);
    setProgress(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          setCurrentIdx((idx) => (idx + 1) % images.length);
          return 0;
        }
        return prev + 1 / intervalSec;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [images, intervalSec]);
  useEffect(() => {
    async function fetchImages() {
      setLoading(true);
      try {
        const res = await fetch(
          `https://corsproxy.io/?https://www.reddit.com/r/${subreddit}/hot.json?limit=50`
        );
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
                    value={subredditInput}
                    autoFocus
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
        {!loading && images.length > 0 && (
          <div className="image-viewer">
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
                  className="fas fa-cog"
                  style={{ fontSize: "28px", color: "#888" }}
                ></i>
              </button>
            </div>
            <a
              href={`https://reddit.com${images[currentIdx].permalink}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={images[currentIdx].url}
                alt={images[currentIdx].title}
                className="main-image"
                style={{ objectFit: "contain", width: "100%", height: "400px" }}
              />
            </a>
            <p>{images[currentIdx].title}</p>
          </div>
        )}
        {!loading && images.length === 0 && hasFetched && (
          <div className="error-container">
            <img
              src="/error.png"
              alt="Subreddit not found"
              className="error-image"
            />
            <h2>Subreddit "{subreddit}" could not be found</h2>
            <p>Please check the name and try again.</p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
