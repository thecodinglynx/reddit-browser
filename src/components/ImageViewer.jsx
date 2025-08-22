import React from "react";

export default function ImageViewer({ images, currentIdx, onNext, onPrev }) {
  const current = images[currentIdx];
  if (!current) return null;

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
        </div>

        {/* nav-row overlay inside image-wrap */}
        <div
          className="nav-row"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 18,
            display: "flex",
            justifyContent: "center",
            gap: "32px",
          }}
        >
          <button
            type="button"
            className="nav-btn"
            aria-label="Previous image"
            onClick={() => {
              if (onPrev) onPrev();
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
              if (onNext) onNext();
            }}
            style={{ fontSize: "1.5em", padding: "8px 24px" }}
            disabled={images.length === 0}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <p style={{ textAlign: "center" }}>{current.title}</p>
    </div>
  );
}
