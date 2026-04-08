import React from "react";

function AnalyticsPanel({ data, loading, error, onRefresh }) {
  const headline = data?.headline || {};
  const chatActivity = data?.chatActivity || [];
  const notificationActivity = data?.notificationActivity || [];
  const teamDistribution = data?.teamDistribution || [];

  return (
    <div className="workspace-form-stack workspace-hub-stack">
      <section className="workspace-hub-header">
        <div>
          <h3>Analytics</h3>
          <p>See usage patterns for saved chats, incoming alerts, and team distribution.</p>
        </div>
        <button type="button" className="hero-button hero-button-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-grid">
        {Object.entries(headline).map(([key, value]) => (
          <article key={key} className="workspace-hub-card">
            <span className="workspace-hub-eyebrow">{key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card">
          <h4>Chat Activity</h4>
          <div className="workspace-analytics-bars">
            {chatActivity.map((item) => (
              <div key={`chat-${item.label}`} className="workspace-analytics-row">
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="workspace-hub-card">
          <h4>Notification Activity</h4>
          <div className="workspace-analytics-bars">
            {notificationActivity.map((item) => (
              <div key={`notification-${item.label}`} className="workspace-analytics-row">
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="workspace-hub-card">
        <h4>Team Distribution</h4>
        {teamDistribution.length > 0 ? (
          <div className="workspace-hub-list">
            {teamDistribution.map((item) => (
              <article key={item.label} className="workspace-hub-list-item">
                <div>
                  <strong>{item.label}</strong>
                  <p>Members with access to this workspace.</p>
                </div>
                <span>{item.value}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="status-item status-info">Create a team to start seeing distribution metrics.</p>
        )}
      </section>
    </div>
  );
}

export default AnalyticsPanel;
