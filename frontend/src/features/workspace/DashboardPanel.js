import React from "react";

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString("en-GB") : "Just now";
}

function normalizeCategoryLabel(value) {
  return (value || "activity").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function DashboardPanel({ data, loading, error, onRefresh }) {
  const metrics = data?.metrics || [];
  const recentActivity = data?.recentActivity || [];
  const activityInsights = data?.activityInsights || [];
  const recentChats = data?.recentChats || [];
  const activeTeamsList = data?.activeTeamsList || [];
  const supportRequestsList = data?.supportRequestsList || [];
  const paymentHistory = data?.paymentHistory || [];

  const spotlight = recentActivity[0] || null;
  const heroMetrics = metrics.slice(0, 4);
  const activityRadarSource = recentActivity.reduce((accumulator, item) => {
    const key = normalizeCategoryLabel(item.category);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
  const activityRadar = Object.entries(activityRadarSource)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 4);
  const maxRadarValue = Math.max(...activityRadar.map((item) => item.value), 1);

  const collections = [
    {
      title: "Conversation Deck",
      subtitle: "The most recent saved chat context and prompt history.",
      items: recentChats,
      emptyText: "No chat activity saved yet.",
      accent: "chat",
    },
    {
      title: "Workspace Access",
      subtitle: "Active personal and shared environments available to this user.",
      items: activeTeamsList,
      emptyText: "No workspace access items yet.",
      accent: "team",
    },
    {
      title: "Support Ledger",
      subtitle: "Open and recently handled support conversations.",
      items: supportRequestsList,
      emptyText: "No support requests recorded.",
      accent: "support",
    },
    {
      title: "Billing Ledger",
      subtitle: "Recent payment and subscription movements on the account.",
      items: paymentHistory,
      emptyText: "No payment activity logged.",
      accent: "payment",
    },
  ];
  const collectionVolume = collections.reduce((total, collection) => total + collection.items.length, 0);
  const operationalBadges = activityInsights.length > 0
    ? activityInsights
    : [
        {
          label: "Signals tracked",
          value: recentActivity.length,
          detail: "Recent events flowing through the workspace command center.",
        },
        {
          label: "Collections live",
          value: collectionVolume,
          detail: "Saved chats, teams, requests, and payments ready to review.",
        },
        {
          label: "Top focus",
          value: activityRadar[0]?.label || "No activity",
          detail: "The strongest active lane across the current workspace.",
        },
      ];

  return (
    <div className="workspace-premium-shell workspace-dashboard-shell">
      <section className="workspace-command-hero">
        <article className="workspace-hub-card workspace-hub-card-square workspace-command-story">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Executive Command</span>
              <h3 className="workspace-command-title">Workspace control tower</h3>
              <p className="workspace-command-lede">
                A premium operator view across collaboration, saved intelligence, service activity, and billing health.
              </p>
            </div>
            <button type="button" className="hero-button hero-button-secondary workspace-command-refresh" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="workspace-command-badge-row">
            {operationalBadges.map((item) => (
              <div key={item.label} className="workspace-command-badge">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail || "No extra details yet."}</p>
              </div>
            ))}
          </div>

          {spotlight ? (
            <div className="workspace-spotlight-panel">
              <div className="workspace-spotlight-head">
                <span className="workspace-spotlight-tag">{normalizeCategoryLabel(spotlight.category)}</span>
                <span className="workspace-spotlight-time">{formatTimestamp(spotlight.createdAt)}</span>
              </div>
              <strong>{spotlight.title}</strong>
              <p>{spotlight.detail}</p>
            </div>
          ) : null}
        </article>

        <aside className="workspace-command-sidebar">
          <div className="workspace-signal-grid">
            {heroMetrics.map((item, index) => (
              <article
                key={item.label}
                className={`workspace-hub-card workspace-hub-card-square workspace-signal-tile ${index === 0 ? "is-priority" : ""}`}
              >
                <span className="workspace-hub-eyebrow">{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.hint || "No extra details yet."}</p>
              </article>
            ))}
          </div>

          <article className="workspace-hub-card workspace-hub-card-square workspace-radar-card">
            <div className="workspace-section-heading">
              <div>
                <span className="workspace-command-kicker">Activity Radar</span>
                <h4>Where motion is happening</h4>
              </div>
            </div>
            {activityRadar.length > 0 ? (
              <div className="workspace-radar-list">
                {activityRadar.map((item) => (
                  <div key={item.label} className="workspace-radar-row">
                    <span>{item.label}</span>
                    <div className="workspace-radar-bar">
                      <i className="workspace-radar-fill" style={{ width: `${(item.value / maxRadarValue) * 100}%` }} />
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="status-item status-info">No activity radar data yet.</p>
            )}
          </article>
        </aside>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="workspace-command-main">
        <article className="workspace-hub-card workspace-hub-card-square workspace-command-span-two">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Activity Stream</span>
              <h4>Everything worth attention right now</h4>
            </div>
            <span className="workspace-section-summary">{recentActivity.length} latest events</span>
          </div>
          {recentActivity.length > 0 ? (
            <div className="workspace-activity-stream">
              {recentActivity.map((item) => (
                <article key={item.id} className="workspace-stream-item">
                  <div className="workspace-stream-rail" />
                  <div className="workspace-stream-content">
                    <div className="workspace-stream-head">
                      <span className="workspace-stream-chip">{normalizeCategoryLabel(item.category)}</span>
                      <span className="workspace-stream-time">{formatTimestamp(item.createdAt)}</span>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="status-item status-info">No dashboard activity yet.</p>
          )}
        </article>

        <article className="workspace-hub-card workspace-hub-card-square workspace-lane-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Execution Lanes</span>
              <h4>Where the user is spending time</h4>
            </div>
          </div>
          <div className="workspace-lane-grid">
            {collections.map((collection) => (
              <div key={collection.title} className={`workspace-lane-tile is-${collection.accent}`}>
                <span>{collection.title}</span>
                <strong>{collection.items.length}</strong>
                <p>{collection.subtitle}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace-collection-grid">
        {collections.map((collection) => (
          <article
            key={collection.title}
            className={`workspace-hub-card workspace-hub-card-square workspace-collection-card is-${collection.accent}`}
          >
            <div className="workspace-section-heading">
              <div>
                <span className="workspace-command-kicker">{collection.title}</span>
                <h4>{collection.subtitle}</h4>
              </div>
              <span className="workspace-section-summary">{collection.items.length}</span>
            </div>

            {collection.items.length > 0 ? (
              <div className="workspace-collection-list">
                {collection.items.map((item) => (
                  <article key={item.id} className="workspace-collection-item">
                    <div className="workspace-collection-stack">
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      {item.meta ? <span className="workspace-collection-meta">{item.meta}</span> : null}
                    </div>
                    <span className="workspace-collection-timestamp">{formatTimestamp(item.createdAt)}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="workspace-collection-empty">{collection.emptyText}</p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

export default DashboardPanel;
