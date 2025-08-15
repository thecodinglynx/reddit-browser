import React from "react";

export default function ProgressBar({ progress, intervalSec, onToggleConfig }) {
  return (
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
        onClick={onToggleConfig}
        style={{ marginLeft: "10px" }}
      >
        <i
          className="fa-solid fa-gear"
          style={{ fontSize: "28px", color: "#888" }}
        ></i>
      </button>
    </div>
  );
}
