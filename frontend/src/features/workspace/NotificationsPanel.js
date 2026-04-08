import React from "react";

function NotificationsPanel({ notifications, loading, error, onMarkRead, onMarkAllRead, onRefresh }) {
  return (
    <div className="workspace-form-stack workspace-hub-stack">
      <section className="workspace-hub-header">
        <div>
          <h3>Notifications</h3>
          <p>Track product alerts, team updates, and workspace reminders in one place.</p>
        </div>
        <div className="workspace-hub-actions">
          <button type="button" className="hero-button hero-button-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="hero-button hero-button-primary" onClick={onMarkAllRead} disabled={loading || notifications.length === 0}>
            Mark All Read
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-list">
        {notifications.length > 0 ? (
          notifications.map((item) => (
            <article key={item.id} className={`workspace-hub-list-item ${item.isRead ? "is-read" : ""}`}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <span className="workspace-hub-meta">
                  {item.category} | {item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Just now"}
                </span>
              </div>
              <button
                type="button"
                className="admin-table-action-button"
                disabled={item.isRead}
                onClick={() => onMarkRead(item.id)}
              >
                {item.isRead ? "Read" : "Mark Read"}
              </button>
            </article>
          ))
        ) : (
          <p className="status-item status-info">No notifications yet.</p>
        )}
      </div>
    </div>
  );
}

export default NotificationsPanel;
