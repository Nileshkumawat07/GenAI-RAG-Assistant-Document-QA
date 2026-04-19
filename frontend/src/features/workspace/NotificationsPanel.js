import React, { useMemo, useState } from "react";

import { pushToast } from "../../shared/toast/toastBus";

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

  const visibleNotifications = useMemo(() => {
    const baseItems = notifications.filter((item) => !hiddenIds.includes(item.id));
    if (filter === "unread") {
      return baseItems.filter((item) => !item.isRead);
    }
    if (filter === "actionable") {
      return baseItems.filter((item) => !!item.actionType);
    }
    return baseItems;
  }, [filter, hiddenIds, notifications]);
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

  return (
    <div className="workspace-form-stack workspace-hub-stack">
      <section className="workspace-hub-header">
        <div>
          <h3>Notifications Center</h3>
          <p>Filter alerts, group them by day, take action, and clear noise without losing the important stuff.</p>
        </div>
        <div className="workspace-hub-actions">
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

      <div className="workspace-filter-strip">
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

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-list">
        {Object.keys(groupedNotifications).length > 0 ? (
          Object.entries(groupedNotifications).map(([dateKey, items]) => (
            <div key={dateKey} className="workspace-form-stack">
              <div className="workspace-section-heading">
                <div>
                  <span className="workspace-hub-eyebrow">Notification group</span>
                  <h4>{dateKey}</h4>
                </div>
                <span className="workspace-section-summary">{items.length} items</span>
              </div>

              {items.map((item) => (
                <article
                  key={item.id}
                  className={`workspace-hub-list-item ${item.isRead ? "is-read" : ""}`}
                  onClick={() => onOpenAction?.(item)}
                  role={item.actionType ? "button" : undefined}
                  tabIndex={item.actionType ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (!item.actionType) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenAction?.(item);
                    }
                  }}
                  style={item.actionType ? { cursor: "pointer" } : undefined}
                >
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", width: "100%" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      onClick={(event) => event.stopPropagation()}
                      style={{ marginTop: "4px" }}
                    />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      <span className="workspace-hub-meta">
                        {item.category} • {formatTimestamp(item.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="workspace-hub-actions">
                    <button
                      type="button"
                      className="admin-table-action-button"
                      disabled={item.isRead}
                      onClick={(event) => {
                        event.stopPropagation();
                        onMarkRead(item.id);
                      }}
                    >
                      {item.isRead ? "Read" : "Mark Read"}
                    </button>
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
