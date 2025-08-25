import React from "react";

export default function ConfigModal({
  subredditInputRef,
  subredditInput,
  setSubredditInput,
  sourceType,
  setSourceType,
  userInput,
  setUserInput,
  redditToken,
  setRedditToken,
  intervalSec,
  setIntervalSec,
  onClose,
  onClearSeen,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form className="config-form" autoComplete="off">
          {/* hidden fields to steal browser autofill in stubborn browsers */}
          <input
            type="text"
            name="__fake_username"
            autoComplete="username"
            style={{ display: "none" }}
          />
          <input
            type="password"
            name="__fake_password"
            autoComplete="new-password"
            style={{ display: "none" }}
          />
          <div className="form-row">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                type="radio"
                name="sourceType"
                value="subreddit"
                checked={sourceType === "subreddit"}
                onChange={() => setSourceType("subreddit")}
                style={{ display: "none" }}
              />
              <input
                type="radio"
                name="sourceType"
                value="user"
                checked={sourceType === "user"}
                onChange={() => setSourceType("user")}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <div className="form-row">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ color: "#666", minWidth: 22 }}>
                r/
              </span>
              <input
                // use a less-guessable name to reduce browser autofill likelihood
                name={`subreddit_${Math.random().toString(36).slice(2, 8)}`}
                id="subreddit"
                ref={subredditInputRef}
                value={subredditInput}
                autoFocus
                onFocus={(e) => {
                  e.target.select();
                  if (setSourceType) setSourceType("subreddit");
                }}
                onChange={(e) => {
                  setSubredditInput(e.target.value);
                  if (setSourceType) setSourceType("subreddit");
                }}
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                type="search"
                aria-label="Subreddit"
              />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ color: "#666", minWidth: 22 }}>
                u/
              </span>
              <input
                name={`user_${Math.random().toString(36).slice(2, 8)}`}
                id="user"
                value={userInput}
                onFocus={(e) => {
                  if (setSourceType) setSourceType("user");
                }}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  if (setSourceType) setSourceType("user");
                }}
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                type="search"
                aria-label="User"
              />
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="interval">Interval (seconds)</label>
            <div className="slider-row">
              <input
                name="interval"
                id="interval"
                type="range"
                min="5"
                max="120"
                value={intervalSec}
                step="1"
                onChange={(e) => setIntervalSec(Number(e.target.value))}
              />
              <span className="slider-value">{intervalSec}s</span>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={() => {
                try {
                  localStorage.removeItem("seenPosts");
                } catch (e) {
                  // ignore
                }
                if (onClearSeen) onClearSeen();
              }}
              style={{ marginLeft: 8 }}
            >
              Clear seen history
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
