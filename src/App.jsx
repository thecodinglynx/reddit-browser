import { useEffect, useRef, useState } from "react";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./App.css";
import ProgressBar from "./components/ProgressBar";
import ConfigModal from "./components/ConfigModal";
import ImageViewer from "./components/ImageViewer";

const DEFAULT_SUBREDDIT = "EarthPorn";
const DEFAULT_INTERVAL = 30;

// cookie helpers for persisting interval
function readIntervalFromCookie() {
  try {
    if (typeof document === "undefined") return DEFAULT_INTERVAL;
    const match = document.cookie.match("(?:^|; )rb_interval=([^;]*)");
    if (match && match[1]) {
      const v = Number(decodeURIComponent(match[1]));
      if (!Number.isNaN(v) && v > 0) return v;
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_INTERVAL;
}

function writeIntervalCookie(sec) {
  try {
    if (typeof document === "undefined") return;
    const days = 365;
    const expires = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    ).toUTCString();
    document.cookie = `rb_interval=${encodeURIComponent(
      sec
    )}; expires=${expires}; path=/`;
  } catch (e) {
    // ignore
  }
}

// normalize subreddit input: strip leading r/ or /r/ and lowercase
function normalizeSubreddit(s) {
  try {
    if (!s && s !== "") return "";
    return String(s)
      .trim()
      .replace(/^\/?r\//i, "")
      .toLowerCase();
  } catch (e) {
    return "";
  }
}

function App() {
  const subredditInputRef = useRef(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [subreddit, setSubreddit] = useState(() =>
    normalizeSubreddit(DEFAULT_SUBREDDIT)
  );
  const [subredditInput, setSubredditInput] = useState(DEFAULT_SUBREDDIT);
  const [intervalSec, setIntervalSec] = useState(() =>
    readIntervalFromCookie()
  );
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
  const [sessionSeen, setSessionSeen] = useState(() => {
    try {
      const arr = JSON.parse(sessionStorage.getItem("sessionSeen") || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  });
  const timerRef = useRef();
  const prevImagesLenRef = useRef(0);
  const lastAdvanceRef = useRef(0);
  const MIN_ADVANCE_MS = 400; // ignore advances that happen faster than this
  const advancingRef = useRef(false);

  // Debounce subreddit input
  useEffect(() => {
    const handler = setTimeout(() => {
      const norm = normalizeSubreddit(subredditInput);
      if (norm !== subreddit) {
        setSubreddit(norm);
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

  // persist interval to cookie so duration survives sessions
  useEffect(() => {
    writeIntervalCookie(intervalSec);
  }, [intervalSec]);

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

  const [afterToken, setAfterToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // pendingAdvance removed; use loadMore(true) to request auto-advance

  // helper: fetch a page of posts
  async function fetchPage(after = null) {
    const url = `https://corsproxy.io/?https://www.reddit.com/r/${subreddit}/hot.json?limit=50${
      after ? `&after=${after}` : ""
    }`;
    const headers = {};
    if (redditToken) headers["Authorization"] = `Bearer ${redditToken}`;
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
        const maybePreview =
          d.preview &&
          d.preview.images &&
          d.preview.images[0] &&
          d.preview.images[0].source &&
          d.preview.images[0].source.url
            ? d.preview.images[0].source.url.replace(/&amp;/g, "&")
            : null;

        const postId = d.id || (d.name ? d.name.replace(/^t3_/, "") : null);

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
            id: postId,
          };
        }

        if (lower.endsWith(".gifv")) {
          return {
            type: "video",
            url: rawUrl.replace(/\.gifv$/i, ".mp4"),
            poster: maybePreview || d.thumbnail || null,
            title: d.title,
            permalink: d.permalink,
            id: postId,
          };
        }

        if (lower.endsWith(".mp4") || lower.endsWith(".webm")) {
          return {
            type: "video",
            url: rawUrl,
            poster: maybePreview || d.thumbnail || null,
            title: d.title,
            permalink: d.permalink,
            id: postId,
          };
        }

        if (lower.endsWith(".gif")) {
          return {
            type: "image",
            url: rawUrl,
            title: d.title,
            permalink: d.permalink,
            id: postId,
          };
        }

        if (d.post_hint === "image" || maybePreview) {
          return {
            type: "image",
            url: maybePreview || rawUrl,
            title: d.title,
            permalink: d.permalink,
            id: postId,
          };
        }

        return null;
      })
      .filter(Boolean);

    return { imgs, after: data.data?.after || null };
  }

  // append next page, avoiding duplicates and seen items
  async function loadMore(advanceOnAppend = false) {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      let cursor = afterToken;
      let anyAppended = false;
      // keep fetching subsequent pages until we find unseen items or run out
      for (let attempts = 0; attempts < 10; attempts++) {
        const { imgs, after } = await fetchPage(cursor);
        cursor = after;
        setAfterToken(after);
        // compute which items to append (avoid duplicates / seen)
        let appended = false;
        let startIdx = 0;
        setImages((prev) => {
          const existingIds = new Set(
            prev.map((it) => it.id || it.permalink || it.url).filter(Boolean)
          );
          const filtered = imgs.filter((i) => {
            const id = i.id || i.permalink || i.url;
            if (!id) return false;
            if (existingIds.has(id)) return false;
            if (seen.has(id)) return false;
            if (sessionSeen.has(id)) return false;
            return true;
          });
          if (filtered.length > 0) {
            appended = true;
            startIdx = prev.length;
            return [...prev, ...filtered];
          }
          return prev;
        });
        // If we appended and caller requested an advance, set index outside setImages
        if (appended && advanceOnAppend) {
          // lock advancing to avoid races
          if (!advancingRef.current) {
            advancingRef.current = true;
            lastAdvanceRef.current = Date.now();
            setCurrentIdx(startIdx);
            setTimeout(() => {
              advancingRef.current = false;
            }, MIN_ADVANCE_MS);
          }
        }
        if (appended) {
          anyAppended = true;
          break;
        }
        if (!cursor) break; // no more pages
      }
    } catch (e) {
      // ignore
    }
    setLoadingMore(false);
  }

  // initial fetch (reset pagination)
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setFetchError(false);
      setAfterToken(null);
      try {
        const { imgs, after } = await fetchPage(null);
        if (cancelled) return;
        setAfterToken(after);
        const filtered = imgs.filter((i) => {
          const id = i.id || i.permalink || i.url;
          return id ? !seen.has(id) && !sessionSeen.has(id) : true;
        });
        setImages(filtered);
      } catch (e) {
        setImages([]);
        setFetchError(true);
      }
      setLoading(false);
      setHasFetched(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [subreddit, fetchTrigger, redditToken]);

  // Image cycling effect with pagination-aware advance
  useEffect(() => {
    if (images.length === 0) return;

    // avoid resetting currentIdx when images are appended via loadMore
    const prevLen = prevImagesLenRef.current || 0;
    // if this is an initial load (prev 0 -> now >0) or the list shrank (new search), reset index
    if ((prevLen === 0 && images.length > 0) || images.length < prevLen) {
      setCurrentIdx(0);
    }
    setProgress(0);
    clearInterval(timerRef.current);
    const intervalMs = 100;

    function advanceIndex() {
      // reuse handleNext logic
      handleNext();
    }

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        // if we are in the middle of an advance, do not progress
        if (advancingRef.current) return 0;
        // if we recently advanced manually, give the UI a short grace period
        if (Date.now() - lastAdvanceRef.current < MIN_ADVANCE_MS) {
          return 0;
        }
        if (prev >= 1) {
          advanceIndex();
          return 0;
        }
        return prev + intervalMs / 1000 / intervalSec;
      });
    }, intervalMs);
    prevImagesLenRef.current = images.length;
    return () => clearInterval(timerRef.current);
  }, [images, intervalSec]);

  // navigation handlers used by ImageViewer and auto-advance
  function handleNext() {
    if (advancingRef.current) return;
    const now = Date.now();
    if (now - lastAdvanceRef.current < MIN_ADVANCE_MS) {
      return;
    }
    advancingRef.current = true;
    lastAdvanceRef.current = now;

    setCurrentIdx((idx) => {
      // find next unseen in-session starting after idx
      for (let i = idx + 1; i < images.length; i++) {
        const id = images[i].id || images[i].permalink || images[i].url;
        if (!id || !sessionSeen.has(id)) return i;
      }
      // none found in remaining; if there's more pages, request them
      if (afterToken) {
        loadMore(true);
        return idx; // wait for more
      }
      // try wrapping around to find any unseen
      for (let i = 0; i < images.length; i++) {
        const id = images[i].id || images[i].permalink || images[i].url;
        if (!id || !sessionSeen.has(id)) return i;
      }
      return 0;
    });
    setProgress(0);
    setTimeout(() => {
      advancingRef.current = false;
    }, MIN_ADVANCE_MS);
  }

  function handlePrev() {
    if (advancingRef.current) return;
    const now = Date.now();
    if (now - lastAdvanceRef.current < MIN_ADVANCE_MS) {
      return;
    }
    advancingRef.current = true;
    lastAdvanceRef.current = now;

    setCurrentIdx((idx) => {
      // move back one index (allow previously seen)
      if (idx - 1 >= 0) return idx - 1;
      if (images.length > 0) return images.length - 1;
      return idx;
    });
    setProgress(0);
    setTimeout(() => {
      advancingRef.current = false;
    }, MIN_ADVANCE_MS);
  }

  // when the currently-displayed image changes, mark it as seen (persist)
  useEffect(() => {
    if (!images || images.length === 0) return;
    const current = images[currentIdx];
    if (!current) return;
    const id = current.id || current.permalink || current.url;
    if (!id) return;

    // read storage synchronously to avoid double-marking in StrictMode
    let sessArr = [];
    try {
      sessArr = JSON.parse(sessionStorage.getItem("sessionSeen") || "[]");
    } catch (e) {
      sessArr = [];
    }
    if (sessArr.includes(id)) return;

    // update sessionStorage synchronously
    try {
      const nextSess = [...new Set([...(sessArr || []), id])];
      sessionStorage.setItem("sessionSeen", JSON.stringify(nextSess));
    } catch (e) {}

    // update localStorage synchronously for persistent seen
    try {
      const globalArr = JSON.parse(localStorage.getItem("seenPosts") || "[]");
      const nextGlobal = [
        ...new Set([...(Array.isArray(globalArr) ? globalArr : []), id]),
      ];
      localStorage.setItem("seenPosts", JSON.stringify(nextGlobal));
    } catch (e) {}

    // update React state (keeps UI in sync)
    setSessionSeen((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    console.log("Marking as seen:", id);
  }, [currentIdx, images]);
  const errorActive =
    !loading && hasFetched && (images.length === 0 || fetchError);

  return (
    <>
      <div className={`reddit-browser ${errorActive ? "error" : ""}`}>
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
            onNext={handleNext}
            onPrev={handlePrev}
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
