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

// recent users cookie helpers
function readRecentUsersFromCookie() {
  try {
    if (typeof document === "undefined") return [];
    const match = document.cookie.match("(?:^|; )rb_recent_users=([^;]*)");
    if (match && match[1]) {
      const v = decodeURIComponent(match[1]);
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {
    // ignore
  }
  return [];
}

function writeRecentUsersCookie(users) {
  try {
    if (typeof document === "undefined") return;
    const days = 365 * 2;
    const expires = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    ).toUTCString();
    const payload = encodeURIComponent(JSON.stringify(users));
    document.cookie = `rb_recent_users=${payload}; expires=${expires}; path=/`;
  } catch (e) {
    // ignore
  }
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

// Heuristic resolver for common external hosts to produce an MP4 URL when possible.
function getExternalVideoUrl(rawUrl) {
  try {
    if (!rawUrl) return null;
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname || "";

    // gfycat: https://gfycat.com/SomeName -> https://giant.gfycat.com/SomeName.mp4
    if (host.endsWith("gfycat.com")) {
      const parts = path.split("/").filter(Boolean);
      const id = parts.pop();
      if (id) return `https://giant.gfycat.com/${id}.mp4`;
    }

    // redgifs: try to map https://www.redgifs.com/watch/<id> to thumbs2.redgifs.com/<id>-mobile.mp4
    if (host.endsWith("redgifs.com")) {
      const parts = path.split("/").filter(Boolean);
      const id = parts.pop();
      if (id) return `https://thumbs2.redgifs.com/${id}-mobile.mp4`;
    }

    // streamable: https://streamable.com/<id> -> https://cdn.streamable.com/video/mp4/<id>.mp4 (best effort)
    if (host.endsWith("streamable.com")) {
      const parts = path.split("/").filter(Boolean);
      const id = parts.pop();
      if (id) return `https://cdn.streamable.com/video/mp4/${id}.mp4`;
    }

    // imgur direct or page links
    if (host.endsWith("imgur.com")) {
      // i.imgur.com direct images
      const idWithExt = path.split("/").pop();
      if (idWithExt) {
        // replace .gifv or .gif with .mp4
        if (idWithExt.endsWith(".gifv") || idWithExt.endsWith(".gif")) {
          return rawUrl.replace(/\.gifv?$/i, ".mp4");
        }
        // page link like imgur.com/abcd -> i.imgur.com/abcd.mp4
        const id = idWithExt.split(".")[0];
        if (id) return `https://i.imgur.com/${id}.mp4`;
      }
    }

    // giphy media urls: media.giphy.com/media/<id>/giphy.gif -> /giphy.mp4
    if (
      host.endsWith("giphy.com") ||
      host.endsWith("media.giphy.com") ||
      host.startsWith("i.")
    ) {
      if (/giphy/i.test(path)) {
        // try to swap gif/gifv -> mp4
        if (/\.gifv?$/.test(path)) return rawUrl.replace(/\.gifv?$/i, ".mp4");
        if (path.endsWith("/giphy.gif") || path.endsWith("/source.gif")) {
          return rawUrl.replace(/giphy\.gif|source\.gif/i, "giphy.mp4");
        }
      }
    }

    // fallback: if the URL ends with .gifv/.gif -> try .mp4
    if (/\.gifv?$/i.test(rawUrl)) return rawUrl.replace(/\.gifv?$/i, ".mp4");
  } catch (e) {
    // ignore
  }
  return null;
}

// build a proxy URL when deployed on a host that supports the API route
function buildProxyUrl(target) {
  try {
    if (!target) return target;
    // In Vercel, the api route is available under the same origin.
    // Use it in production to avoid CORS issues.
    if (typeof window !== "undefined" && window.location.hostname) {
      // Always use the local /api/proxy during development and when running in the browser.
      // The Vite dev server is configured to proxy /api to the local proxy server.
      const encoded = encodeURIComponent(target);
      return `/api/proxy?url=${encoded}`;
    }
    return target;
  } catch (e) {
    return target;
  }
}

// simple in-memory cache to deduplicate concurrent page fetches by URL
const fetchCache = new Map();

function App() {
  const subredditInputRef = useRef(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [subreddit, setSubreddit] = useState(() =>
    normalizeSubreddit(DEFAULT_SUBREDDIT)
  );
  const [subredditInput, setSubredditInput] = useState(DEFAULT_SUBREDDIT);
  const [sourceType, setSourceType] = useState("subreddit");
  const [userInput, setUserInput] = useState("");
  const [recentUsers, setRecentUsers] = useState(() =>
    readRecentUsersFromCookie()
  );
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

  // When sourceType or userInput changes, debounce and trigger a fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      // bump fetchTrigger to force init() effect to run
      setFetchTrigger((v) => v + 1);
    }, 350);
    return () => clearTimeout(handler);
  }, [sourceType, userInput]);

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

  // helper: fetch a page of posts (deduplicated)
  async function fetchPage(after = null) {
    const afterPart = after ? `&after=${after}` : "";
    let redditUrl;
    if (sourceType === "user") {
      // normalize user: strip leading /u/ or u/
      const uname = String(userInput || subreddit)
        .trim()
        .replace(/^\/?u\//i, "");
      redditUrl = `https://www.reddit.com/user/${encodeURIComponent(
        uname
      )}/submitted.json?limit=25${afterPart}`;
    } else {
      redditUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25${afterPart}`;
    }

    const cacheKey = redditUrl;
    if (fetchCache.has(cacheKey)) {
      return fetchCache.get(cacheKey);
    }

    const inFlight = (async () => {
      console.log("fetchPage requesting:", redditUrl);
      const url = buildProxyUrl(redditUrl);
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

          // reddit sometimes provides an mp4 preview for GIFs/videos
          const maybePreviewVideo =
            (d.preview &&
            d.preview.reddit_video_preview &&
            d.preview.reddit_video_preview.fallback_url
              ? d.preview.reddit_video_preview.fallback_url.replace(
                  /&amp;/g,
                  "&"
                )
              : null) ||
            (d.secure_media &&
            d.secure_media.reddit_video &&
            d.secure_media.reddit_video.fallback_url
              ? d.secure_media.reddit_video.fallback_url
              : null);

          const postId = d.id || (d.name ? d.name.replace(/^t3_/, "") : null);

          if (
            d.is_video &&
            d.media &&
            d.media.reddit_video &&
            d.media.reddit_video.fallback_url
          ) {
            return {
              type: "video",
              url: buildProxyUrl(d.media.reddit_video.fallback_url),
              origUrl: d.media.reddit_video.fallback_url,
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

          // check external resolvers first
          const externalMp4 = getExternalVideoUrl(rawUrl);
          if (externalMp4) {
            return {
              type: "video",
              url: buildProxyUrl(externalMp4),
              origUrl: externalMp4,
              poster: maybePreview || d.thumbnail || null,
              title: d.title,
              permalink: d.permalink,
              id: postId,
            };
          }

          if (lower.endsWith(".mp4") || lower.endsWith(".webm")) {
            return {
              type: "video",
              url: buildProxyUrl(rawUrl),
              origUrl: rawUrl,
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

          // fallback: if there's a preview video available, prefer showing it as video
          if (maybePreviewVideo) {
            return {
              type: "video",
              url: buildProxyUrl(maybePreviewVideo),
              origUrl: maybePreviewVideo,
              poster: maybePreview || d.thumbnail || null,
              title: d.title,
              permalink: d.permalink,
              id: postId,
            };
          }

          return null;
        })
        .filter(Boolean);

      return { imgs, after: data.data?.after || null };
    })();

    fetchCache.set(cacheKey, inFlight);
    inFlight.finally(() => {
      setTimeout(() => fetchCache.delete(cacheKey), 2000);
    });

    return inFlight;
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
        // if we fetched a user's submissions and got results, persist the username to recent list
        if (sourceType === "user") {
          try {
            const uname = String(userInput || subreddit)
              .trim()
              .replace(/^\/?u\//i, "");
            if (filtered.length > 0 && uname) {
              setRecentUsers((prev) => {
                const next = [uname, ...prev.filter((p) => p !== uname)].slice(
                  0,
                  10
                );
                try {
                  writeRecentUsersCookie(next);
                } catch (e) {}
                return next;
              });
            }
          } catch (e) {}
        }
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
            sourceType={sourceType}
            setSourceType={setSourceType}
            userInput={userInput}
            setUserInput={setUserInput}
            redditToken={redditToken}
            setRedditToken={setRedditToken}
            intervalSec={intervalSec}
            setIntervalSec={setIntervalSec}
            recentUsers={recentUsers}
            setRecentUsers={setRecentUsers}
            writeRecentUsersCookie={writeRecentUsersCookie}
            redditClientId={redditClientId}
            redditClientSecret={redditClientSecret}
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
            <h2>
              {sourceType === "user" ? "User" : "Subreddit"} "
              {sourceType === "user" ? userInput || subreddit : subreddit}"
              could not be found
            </h2>
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
