import React from "react";

function DashboardPanel({ data, loading, error, onRefresh }) {
  const metrics = data?.metrics || [];
  const recentActivity = data?.recentActivity || [];
  const activityInsights = data?.activityInsights || [];
  const recentChats = data?.recentChats || [];
  const activeTeamsList = data?.activeTeamsList || [];
  const supportRequestsList = data?.supportRequestsList || [];
  const paymentHistory = data?.paymentHistory || [];

  const renderCollection = (items, emptyText) => (
    items.length > 0 ? (
      <div className="workspace-hub-list">
        {items.map((item) => (
          <article key={item.id} className="workspace-hub-list-item workspace-hub-list-item-square">
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              {item.meta ? <span className="workspace-hub-inline-meta">{item.meta}</span> : null}
            </div>
            <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Just now"}</span>
          </article>
        ))}
      </div>
    ) : (
      <p className="status-item status-info">{emptyText}</p>
    )
  );

  return (
    <div className="workspace-form-stack workspace-hub-stack">
      <section className="workspace-hub-header">
        <div>
          <h3>Workspace Dashboard</h3>
          <p>See the latest activity across notifications, chats, teams, support, and billing.</p>
        </div>
        <button type="button" className="hero-button hero-button-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-grid">
        {metrics.map((item) => (
          <article key={item.label} className="workspace-hub-card workspace-hub-card-square">
            <span className="workspace-hub-eyebrow">{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.hint || "No extra details yet."}</p>
          </article>
        ))}
      </div>

      <div className="workspace-hub-grid">
        {activityInsights.map((item) => (
          <article key={item.label} className="workspace-hub-card workspace-hub-card-square workspace-hub-card-compact">
            <span className="workspace-hub-eyebrow">{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail || "No extra details yet."}</p>
          </article>
        ))}
      </div>

      <section className="workspace-hub-card workspace-hub-card-square">
        <h4>Recent Activity</h4>
        {recentActivity.length > 0 ? (
          <div className="workspace-hub-list">
            {recentActivity.map((item) => (
              <article key={item.id} className="workspace-hub-list-item workspace-hub-list-item-square">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  {item.category ? <span className="workspace-hub-inline-meta">{item.category}</span> : null}
                </div>
                <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Just now"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="status-item status-info">No dashboard activity yet.</p>
        )}
      </section>

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Recent Chats</h4>
          {renderCollection(recentChats, "No chat activity saved yet.")}
        </section>

        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Workspace Access</h4>
          {renderCollection(activeTeamsList, "No workspace access items yet.")}
        </section>
      </div>

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Support Requests</h4>
          {renderCollection(supportRequestsList, "No support requests recorded.")}
        </section>

        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Payment History</h4>
          {renderCollection(paymentHistory, "No payment activity logged.")}
        </section>
      </div>
    </div>
  );
}

export default DashboardPanel;
