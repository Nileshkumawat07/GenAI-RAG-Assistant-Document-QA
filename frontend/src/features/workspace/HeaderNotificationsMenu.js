import React, { useMemo, useState } from "react";

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString("en-GB") : "Just now";
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

function normalizeCategory(value) {
  return (value || "notification").replace(/[-_]/g, " ").toUpperCase();
}

function getInitials(item) {
  const source = item.title || item.category || "N";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function HeaderNotificationsMenu({
  notifications,
  loading,
  error,
  onRefresh,
  onOpenAction,
  onMarkRead,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filteredNotifications = useMemo(() => {
    const filtered = filter === "unread"
      ? notifications.filter((item) => !item.isRead)
      : filter === "actionable"
        ? notifications.filter((item) => Boolean(item.actionType))
        : notifications;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return filtered;
    }
    return filtered.filter((item) =>
      `${item.title || ""} ${item.message || ""} ${item.category || ""}`.toLowerCase().includes(normalizedQuery)
    );
  }, [filter, notifications, query]);

  const grouped = useMemo(() => groupNotifications(filteredNotifications), [filteredNotifications]);

  const handleItemClick = async (item) => {
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
    <div className="header-notifications-panel">
      <div className="header-notifications-top">
        <div>
          <span className="header-notifications-kicker">Live Alerts</span>
          <h3>Notifications</h3>
        </div>
        <button type="button" className="header-notifications-refresh" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="header-notifications-controls">
        <div className="header-notifications-filters">
          {[
            { id: "all", label: "All", count: notifications.length },
            { id: "unread", label: "Unread", count: notifications.filter((item) => !item.isRead).length },
            { id: "actionable", label: "Actionable", count: notifications.filter((item) => Boolean(item.actionType)).length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`header-notifications-filter ${filter === item.id ? "is-active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>

        <label className="header-notifications-search">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, message, or category..."
          />
        </label>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="header-notifications-scroll">
        {Object.keys(grouped).length > 0 ? (
          Object.entries(grouped).map(([dateKey, items]) => (
            <section key={dateKey} className="header-notifications-group">
              <div className="header-notifications-group-head">
                <div>
                  <span className="header-notifications-group-label">Notification group</span>
                  <h4>{dateKey}</h4>
                </div>
                <span>{items.length} items</span>
              </div>

              <div className="header-notifications-group-list">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`header-notifications-card ${item.isRead ? "is-read" : "is-unread"}`}
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="header-notifications-rail" aria-hidden="true" />
                    <span className="header-notifications-avatar" aria-hidden="true">{getInitials(item)}</span>
                    <span className="header-notifications-copy">
                      <span className="header-notifications-meta-row">
                        <span className="header-notifications-chip-row">
                          <span className="header-notifications-chip">{normalizeCategory(item.category)}</span>
                          {!item.isRead ? <span className="header-notifications-chip is-new">NEW</span> : null}
                        </span>
                        <span className="header-notifications-time">{formatTimestamp(item.createdAt)}</span>
                      </span>
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="status-item status-info">No notifications match the current filter.</p>
        )}
      </div>
    </div>
  );
}

export default HeaderNotificationsMenu;
