import React from "react";

export default function ImageViewer({
  images,
  currentIdx,
  setCurrentIdx,
  setProgress,
}) {
  const current = images[currentIdx];
  if (!current) return null;

  return (
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
          href={`https://reddit.com${current.permalink}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1 }}
        >
          {current.type === "video" ? (
            <video
              className="main-image"
              src={current.url}
              poster={current.poster}
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
        </a>
      </div>
      <p style={{ textAlign: "center" }}>{current.title}</p>
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
            setCurrentIdx((idx) => (idx - 1 + images.length) % images.length);
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
  );
}
