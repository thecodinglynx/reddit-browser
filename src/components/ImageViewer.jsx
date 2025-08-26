import React, { useEffect, useRef, useState } from "react";

export default function ImageViewer({
  images,
  currentIdx,
  onNext,
  onPrev,
  paused,
  onTogglePaused,
}) {
  const current = images[currentIdx];
  if (!current) return null;

  // normalize author for display; show 'unknown' when missing or deleted
  const rawAuthor = current.author || "";
  let displayAuthor = "unknown";
  try {
    const a = String(rawAuthor).trim();
    if (a && a !== "[deleted]" && a.toLowerCase() !== "null") {
      displayAuthor = a.startsWith("u/") ? a : `u/${a}`;
    }
  } catch (e) {
    displayAuthor = "unknown";
  }

  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // reset playback state when media changes
  useEffect(() => {
    setPlaying(true);
    setMuted(true);
  }, [current && (current.id || current.url)]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      // play returns a promise in some browsers
      const p = v.play();
      if (p && p.catch)
        p.catch((err) => {
          // mark error so UI can show retry/external link
          console.warn("Video play failed:", err);
          setVideoError(true);
          setPlaying(false);
        });
    } else {
      v.pause();
    }
  }, [playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !!muted;
  }, [muted]);

  return (
    <div className="image-viewer">
      <div
        className="image-wrap"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
          marginBottom: "8px",
          position: "relative",
        }}
      >
        <div style={{ flex: 1 }}>
          {current.type === "video" ? (
            <video
              ref={videoRef}
              className="main-image"
              src={current.url}
              poster={current.poster}
              muted={muted}
              autoPlay
              loop
              playsInline
              onError={() => {
                setVideoError(true);
              }}
              onCanPlay={() => {
                setVideoError(false);
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <img
              src={current.url}
              alt={current.title}
              className="main-image"
              style={{
                objectFit: "contain",
                width: "100%",
                height: "100%",
              }}
            />
          )}
        </div>

        {/* nav-row overlay inside image-wrap */}
        <div
          className="nav-row"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            display: "flex",
            justifyContent: "flex-start",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="nav-btn"
            aria-label="Previous image"
            onClick={() => {
              if (onPrev) onPrev();
            }}
            style={{ fontSize: "1.2em", padding: "6px 10px" }}
            disabled={images.length === 0}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          {/* pause/play center button */}
          <button
            type="button"
            className="nav-btn"
            aria-label={paused ? "Resume" : "Pause"}
            onClick={() => {
              if (onTogglePaused) onTogglePaused();
            }}
            style={{ fontSize: "1.1em", padding: "6px 10px" }}
          >
            <i
              className={paused ? "fa-solid fa-play" : "fa-solid fa-pause"}
            ></i>
          </button>

          <button
            type="button"
            className="nav-btn"
            aria-label="Next image"
            onClick={() => {
              if (onNext) onNext();
            }}
            style={{ fontSize: "1.2em", padding: "6px 10px" }}
            disabled={images.length === 0}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          {/* uploader badge bottom-right (visually aligned with nav buttons) */}
          <div
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#fff",
              color: "#000",
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: "0.9em",
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              display: "inline-block",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            {displayAuthor}
          </div>
        </div>

        {/* playback controls for videos */}
        {current.type === "video" && (
          <>
            <div
              className="video-controls"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                display: "flex",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="nav-btn"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => {
                  setVideoError(false);
                  setPlaying((v) => !v);
                }}
                style={{ padding: "6px 10px" }}
              >
                <i
                  className={playing ? "fa-solid fa-pause" : "fa-solid fa-play"}
                ></i>
              </button>
              <button
                type="button"
                className="nav-btn"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => setMuted((v) => !v)}
                style={{ padding: "6px 10px" }}
              >
                <i
                  className={
                    muted
                      ? "fa-solid fa-volume-xmark"
                      : "fa-solid fa-volume-high"
                  }
                ></i>
              </button>
            </div>

            {videoError && (
              <div
                className="video-error"
                style={{
                  position: "absolute",
                  left: 10,
                  top: 10,
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  padding: 8,
                  borderRadius: 6,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.9em" }}>Video failed to play</span>
                <button
                  className="nav-btn"
                  onClick={() => {
                    setVideoError(false);
                    // try to play again
                    setPlaying(true);
                    const v = videoRef.current;
                    if (v) {
                      const p = v.play();
                      if (p && p.catch) p.catch(() => setVideoError(true));
                    }
                  }}
                  style={{ padding: "4px 8px" }}
                >
                  Retry
                </button>
                <button
                  className="nav-btn"
                  onClick={() =>
                    window.open(current.origUrl || current.url, "_blank")
                  }
                  style={{ padding: "4px 8px" }}
                >
                  Open
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p style={{ textAlign: "center" }}>{current.title}</p>
    </div>
  );
}
