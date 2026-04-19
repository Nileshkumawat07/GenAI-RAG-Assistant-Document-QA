import React, { useMemo, useState } from "react";

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString("en-GB") : "Just now";
}

function normalizeCategory(value) {
  return (value || "notification").replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getNotificationInitials(item) {
  const source = item.title || item.category || "N";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getNotificationActionLabel(item) {
  if (item.actionType) {
    return "Tap to open workflow";
  }
  return item.isRead ? "Viewed update" : "Tap to mark as seen";
}

function groupNotifications(notifications) {
  return notifications.reduce((accumulator, item) => {
    const dateKey = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "Today";

    if (!accumulator[dateKey]) {
      accumulator[dateKey] = [];
    }

    accumulator[dateKey].push(item);
    return accumulator;
  }, {});
}

function NotificationsPanel({
  notifications,
  loading,
  error,
  onMarkRead,
  onRefresh,
  onOpenAction,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const visibleNotifications = useMemo(() => {
    const filteredItems = filter === "unread"
      ? notifications.filter((item) => !item.isRead)
      : filter === "actionable"
        ? notifications.filter((item) => !!item.actionType)
        : notifications;
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return filteredItems;
    }

    return filteredItems.filter((item) => (
      `${item.title || ""} ${item.message || ""} ${item.category || ""}`.toLowerCase().includes(normalizedQuery)
    ));
  }, [filter, notifications, query]);

  const groupedNotifications = useMemo(() => groupNotifications(visibleNotifications), [visibleNotifications]);

  const handleNotificationActivate = async (item) => {
    if (!item) {
      return;
    }

    if (item.actionType) {
      await onOpenAction?.(item);
      return;
    }

    if (!item.isRead) {
      await onMarkRead?.(item.id);
    }
  };

  return (
    <div className="workspace-form-stack workspace-hub-stack workspace-notifications-shell">
      <section className="workspace-hub-header workspace-notifications-header">
        <div className="workspace-notifications-title-block">
          <div className="workspace-notifications-kicker-row">
            <span className="workspace-hub-eyebrow">Live Alerts</span>
            <span className="workspace-notification-shortcut-hint">Alt+N to open • Esc to close</span>
          </div>
          <h3>Notifications Center</h3>
          <p>Realtime updates with a cleaner premium flow. Tap a card to open its action or mark it seen.</p>
        </div>
        <div className="workspace-hub-actions workspace-notifications-toolbar">
          <button type="button" className="hero-button hero-button-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="workspace-notifications-commandbar">
        <div className="workspace-filter-strip workspace-notification-filter-strip">
          {[
            { id: "all", label: "All", count: notifications.length },
            { id: "unread", label: "Unread", count: notifications.filter((item) => !item.isRead).length },
            { id: "actionable", label: "Actionable", count: notifications.filter((item) => !!item.actionType).length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`workspace-filter-pill ${filter === item.id ? "is-active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>

        <label className="workspace-search-shell workspace-notification-search">
          <span>Search alerts</span>
          <input
            type="text"
            className="workspace-input workspace-command-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, message, or category..."
          />
        </label>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-list workspace-notification-list">
        {Object.keys(groupedNotifications).length > 0 ? (
          Object.entries(groupedNotifications).map(([dateKey, items]) => (
            <div key={dateKey} className="workspace-form-stack workspace-notification-group">
              <div className="workspace-section-heading workspace-notification-group-heading">
                <div>
                  <span className="workspace-hub-eyebrow">Notification group</span>
                  <h4>{dateKey}</h4>
                </div>
                <span className="workspace-section-summary">{items.length} items</span>
              </div>

              {items.map((item) => (
                <article
                  key={item.id}
                  className={`workspace-hub-list-item workspace-notification-card ${item.isRead ? "is-read" : "is-unread"} ${item.actionType ? "is-actionable" : "is-passive"}`}
                  onClick={() => handleNotificationActivate(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleNotificationActivate(item);
                    }
                  }}
                >
                  <div className="workspace-notification-card-rail" aria-hidden="true" />
                  <div className="workspace-notification-card-main">
                    <div className="workspace-notification-avatar" aria-hidden="true">
                      {getNotificationInitials(item)}
                    </div>
                    <div className="workspace-notification-copy">
                      <div className="workspace-notification-topline">
                        <div className="workspace-notification-chip-row">
                          <span className="workspace-stream-chip">{normalizeCategory(item.category)}</span>
                          {!item.isRead ? <span className="workspace-notification-status-chip">New</span> : null}
                          {item.actionType ? <span className="workspace-notification-status-chip is-action">Action</span> : null}
                        </div>
                        <span className="workspace-notification-timestamp">{formatTimestamp(item.createdAt)}</span>
                      </div>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      <span className="workspace-hub-meta workspace-notification-meta">
                        {getNotificationActionLabel(item)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ))
        ) : (
          <p className="status-item status-info">No notifications match the current filter.</p>
        )}
      </div>
    </div>
  );
}

export default NotificationsPanel;
