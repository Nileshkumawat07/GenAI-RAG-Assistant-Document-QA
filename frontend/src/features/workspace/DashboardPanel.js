import React from "react";

function DashboardPanel({ data, loading, error, onRefresh }) {
  const metrics = data?.metrics || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="workspace-form-stack workspace-hub-stack">
      <section className="workspace-hub-header">
        <div>
          <h3>Workspace Dashboard</h3>
          <p>See the latest activity across notifications, saved chats, teams, and support flow.</p>
        </div>
        <button type="button" className="hero-button hero-button-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-grid">
        {metrics.map((item) => (
          <article key={item.label} className="workspace-hub-card">
            <span className="workspace-hub-eyebrow">{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.hint || "No extra details yet."}</p>
          </article>
        ))}
      </div>

      <section className="workspace-hub-card">
        <h4>Recent Activity</h4>
        {recentActivity.length > 0 ? (
          <div className="workspace-hub-list">
            {recentActivity.map((item) => (
              <article key={item.id} className="workspace-hub-list-item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Just now"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="status-item status-info">No dashboard activity yet.</p>
        )}
      </section>
    </div>
  );
}

export default DashboardPanel;
