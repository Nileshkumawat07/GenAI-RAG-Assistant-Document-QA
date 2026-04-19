import React, { useMemo, useState } from "react";

import { pushToast } from "../../shared/toast/toastBus";

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
    return "Open workflow";
  }
  return item.isRead ? "Viewed update" : "Mark as seen";
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
  onMarkAllRead,
  onRefresh,
  onOpenAction,
}) {
  const [filter, setFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [query, setQuery] = useState("");

  const visibleNotifications = useMemo(() => {
    const baseItems = notifications.filter((item) => !hiddenIds.includes(item.id));
    const filteredItems = filter === "unread"
      ? baseItems.filter((item) => !item.isRead)
      : filter === "actionable"
        ? baseItems.filter((item) => !!item.actionType)
        : baseItems;
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return filteredItems;
    }

    return filteredItems.filter((item) => (
      `${item.title || ""} ${item.message || ""} ${item.category || ""}`.toLowerCase().includes(normalizedQuery)
    ));
  }, [filter, hiddenIds, notifications, query]);

  const groupedNotifications = useMemo(() => groupNotifications(visibleNotifications), [visibleNotifications]);

  const toggleSelected = (notificationId) => {
    setSelectedIds((current) =>
      current.includes(notificationId)
        ? current.filter((item) => item !== notificationId)
        : [...current, notificationId]
    );
  };

  const handleBulkRead = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    await Promise.all(selectedIds.map((notificationId) => onMarkRead(notificationId)));
    setSelectedIds([]);
    pushToast({ type: "success", title: "Selection updated", message: "Selected notifications were marked as read." });
  };

  const handleBulkClear = () => {
    if (selectedIds.length === 0) {
      return;
    }

    setHiddenIds((current) => [...new Set([...current, ...selectedIds])]);
    setSelectedIds([]);
    pushToast({ type: "info", title: "Selection cleared", message: "Selected notifications were removed from this view." });
  };

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
          <h3>Notifications Center</h3>
          <p>Filter alerts, group them by day, take action, and clear noise without losing the important stuff.</p>
        </div>
        <div className="workspace-hub-actions workspace-notifications-toolbar">
          <button type="button" className="hero-button hero-button-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="hero-button hero-button-secondary" onClick={handleBulkRead} disabled={loading || selectedIds.length === 0}>
            Mark Selected Read
          </button>
          <button type="button" className="hero-button hero-button-secondary" onClick={handleBulkClear} disabled={selectedIds.length === 0}>
            Clear Selected
          </button>
          <button type="button" className="hero-button hero-button-primary" onClick={onMarkAllRead} disabled={loading || notifications.length === 0}>
            Mark All Read
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

      <div className="workspace-hub-list">
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
                    <input
                      className="workspace-notification-checkbox"
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
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
                  <div className="workspace-notification-side">
                    <span className="workspace-notification-open-hint">
                      {item.actionType ? "Open" : item.isRead ? "Viewed" : "Review"}
                    </span>
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
