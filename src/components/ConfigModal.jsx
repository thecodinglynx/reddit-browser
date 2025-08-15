import React from "react";

export default function ConfigModal({
  subredditInputRef,
  subredditInput,
  setSubredditInput,
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
            <label htmlFor="redditToken">Reddit access token (optional)</label>
            <input
              name="redditToken"
              id="redditToken"
              value={redditToken}
              placeholder="Paste OAuth access token here"
              onChange={(e) => setRedditToken(e.target.value)}
            />
            <small style={{ color: "#666" }}>
              Optional: paste a Reddit OAuth access token to increase rate
              limits. For security, prefer using a server-side proxy.
            </small>
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
