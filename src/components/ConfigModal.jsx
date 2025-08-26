import React from "react";

export default function ConfigModal({
  subredditInputRef,
  subredditInput,
  setSubredditInput,
  sourceType,
  setSourceType,
  userInput,
  setUserInput,
  recentUsers,
  setRecentUsers,
  writeRecentUsersCookie,
  redditToken,
  setRedditToken,
  intervalSec,
  setIntervalSec,
  onClose,
  onClearSeen,
}) {
  const recentSelectRef = React.useRef(null);
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

          <div className="form-row">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ color: "#666", minWidth: 22 }}>
                u/
              </span>
              <input
                name={`user_${Math.random().toString(36).slice(2, 8)}`}
                id="user"
                value={userInput}
                onFocus={(e) => {
                  e.target.select();
                  if (setSourceType) setSourceType("user");
                }}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  if (setSourceType) setSourceType("user");
                }}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                type="search"
                aria-label="User"
              />

              {recentUsers && recentUsers.length > 0 && (
                <select
                  aria-label="Recent users"
                  ref={recentSelectRef}
                  value={
                    recentUsers && recentUsers.includes(userInput)
                      ? userInput
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      setUserInput(v);
                      if (setSourceType) setSourceType("user");
                    }
                  }}
                  style={{ marginLeft: 8 }}
                >
                  <option value="">Recent</option>
                  {recentUsers.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                aria-label="Clear user and switch to subreddit"
                title="Clear user"
                className="icon-btn"
                onClick={() => {
                  try {
                    setUserInput("");
                  } catch (e) {}
                  try {
                    if (recentSelectRef && recentSelectRef.current) {
                      recentSelectRef.current.value = "";
                    }
                  } catch (e) {}
                  // clear the stored recent users and cookie
                  try {
                    if (setRecentUsers) setRecentUsers([]);
                  } catch (e) {}
                  try {
                    if (writeRecentUsersCookie) writeRecentUsersCookie([]);
                  } catch (e) {}
                  if (setSourceType) setSourceType("subreddit");
                  try {
                    if (subredditInputRef && subredditInputRef.current) {
                      subredditInputRef.current.focus();
                      subredditInputRef.current.select();
                    }
                  } catch (e) {}
                }}
                style={{
                  marginLeft: 6,
                  background: "none",
                  border: "none",
                  padding: 6,
                  cursor: "pointer",
                  color: "#666",
                }}
              >
                <i className="fas fa-times-circle" aria-hidden></i>
              </button>
            </div>
          </div>

          <div className="form-row">
            {/* keep label for screen readers but hide visually */}
            <label htmlFor="interval" className="visually-hidden">
              Interval (seconds)
            </label>
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
              <span
                className="slider-value"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {intervalSec}s<i className="fas fa-sync-alt" aria-hidden></i>
              </span>
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
