import React, { startTransition, useDeferredValue, useState } from "react";

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString("en-GB") : "Just now";
}

function normalizeCategoryLabel(value) {
  return (value || "activity").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSearchIndex(...values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function matchesActivityFilter(item, filterKey) {
  if (filterKey === "all") {
    return true;
  }

  const category = String(item.category || "").toLowerCase();
  const searchIndex = buildSearchIndex(item.title, item.detail, item.category);

  if (filterKey === "notification") {
    return ["notification", "alert", "welcome", "product"].some((token) => searchIndex.includes(token) || category.includes(token))
      || ["welcome", "product", "chat", "team"].includes(category);
  }

  if (filterKey === "chat") {
    return ["chat", "thread", "message"].some((token) => searchIndex.includes(token) || category.includes(token));
  }

  if (filterKey === "team") {
    return ["team", "workspace", "member"].some((token) => searchIndex.includes(token) || category.includes(token));
  }

  if (filterKey === "support") {
    return ["support", "request", "contact", "ticket"].some((token) => searchIndex.includes(token) || category.includes(token));
  }

  if (filterKey === "payment") {
    return ["payment", "billing", "subscription", "invoice"].some((token) => searchIndex.includes(token) || category.includes(token));
  }

  return true;
}

function buildInspectorRecord({ source, accent, item }) {
  return {
    id: item.id,
    source,
    accent,
    category: normalizeCategoryLabel(item.category || accent || source),
    title: item.title,
    detail: item.detail,
    meta: item.meta || (source === "activity" ? "Workspace signal" : "Workspace record"),
    createdAt: item.createdAt,
  };
}

function DashboardPanel({ data, loading, error, onRefresh }) {
  const metrics = data?.metrics || [];
  const recentActivity = data?.recentActivity || [];
  const activityInsights = data?.activityInsights || [];
  const recentChats = data?.recentChats || [];
  const activeTeamsList = data?.activeTeamsList || [];
  const supportRequestsList = data?.supportRequestsList || [];
  const paymentHistory = data?.paymentHistory || [];

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

  const [activeFilter, setActiveFilter] = useState("all");
  const [activityQuery, setActivityQuery] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [selectedCollectionAccent, setSelectedCollectionAccent] = useState(collections[0]?.accent || "chat");
  const [selectedInspector, setSelectedInspector] = useState(null);
  const deferredActivityQuery = useDeferredValue(activityQuery);

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

  const filterButtons = [
    { key: "all", label: "All activity" },
    { key: "notification", label: "Notifications" },
    { key: "chat", label: "Chats" },
    { key: "team", label: "Teams" },
    { key: "support", label: "Support" },
    { key: "payment", label: "Payments" },
  ].map((item) => ({
    ...item,
    count: recentActivity.filter((entry) => matchesActivityFilter(entry, item.key)).length,
  }));

  const normalizedQuery = deferredActivityQuery.trim().toLowerCase();
  const filteredRecentActivity = recentActivity.filter((item) => {
    const matchesFilter = matchesActivityFilter(item, activeFilter);
    const matchesQuery = !normalizedQuery || buildSearchIndex(item.title, item.detail, item.category).includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
  const filteredCollections = collections.map((collection) => ({
    ...collection,
    filteredItems: collection.items.filter((item) => (
      !normalizedQuery || buildSearchIndex(item.title, item.detail, item.meta).includes(normalizedQuery)
    )),
  }));
  const focusedCollection = filteredCollections.find((item) => item.accent === selectedCollectionAccent) || filteredCollections[0] || null;
  const spotlight = filteredRecentActivity.find((item) => item.id === selectedActivityId) || filteredRecentActivity[0] || recentActivity[0] || null;
  const inspectorRecord = selectedInspector
    || (spotlight ? buildInspectorRecord({ source: "activity", accent: spotlight.category, item: spotlight }) : null)
    || (focusedCollection?.filteredItems?.[0] ? buildInspectorRecord({
      source: "collection",
      accent: focusedCollection.accent,
      item: focusedCollection.filteredItems[0],
    }) : null);

  const handleFilterChange = (nextFilter) => {
    startTransition(() => {
      setActiveFilter(nextFilter);
      setSelectedActivityId("");
      setSelectedInspector(null);
    });
  };

  const handleActivitySelect = (item) => {
    startTransition(() => {
      setSelectedActivityId(item.id);
      setSelectedInspector(buildInspectorRecord({ source: "activity", accent: item.category, item }));
    });
  };

  const handleCollectionFocus = (accent) => {
    startTransition(() => {
      setSelectedCollectionAccent(accent);
    });
  };

  const handleCollectionSelect = (accent, item) => {
    startTransition(() => {
      setSelectedCollectionAccent(accent);
      setSelectedInspector(buildInspectorRecord({ source: "collection", accent, item }));
    });
  };

  const handleMetricFocus = (label) => {
    const normalizedLabel = String(label || "").toLowerCase();
    if (normalizedLabel.includes("notification")) {
      handleFilterChange("notification");
      return;
    }
    if (normalizedLabel.includes("chat")) {
      handleFilterChange("chat");
      return;
    }
    if (normalizedLabel.includes("team")) {
      handleFilterChange("team");
      return;
    }
    if (normalizedLabel.includes("support")) {
      handleFilterChange("support");
      return;
    }
    if (normalizedLabel.includes("payment")) {
      handleFilterChange("payment");
      return;
    }
    handleFilterChange("all");
  };

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
              <button
                key={item.label}
                type="button"
                className="workspace-command-badge workspace-card-button"
                onClick={() => handleMetricFocus(item.label)}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail || "No extra details yet."}</p>
              </button>
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
            {metrics.slice(0, 4).map((item, index) => (
              <button
                key={item.label}
                type="button"
                className={`workspace-hub-card workspace-hub-card-square workspace-signal-tile workspace-card-button ${index === 0 ? "is-priority" : ""}`}
                onClick={() => handleMetricFocus(item.label)}
              >
                <span className="workspace-hub-eyebrow">{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.hint || "No extra details yet."}</p>
              </button>
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
                  <button
                    key={item.label}
                    type="button"
                    className="workspace-radar-row workspace-card-button workspace-radar-button"
                    onClick={() => handleFilterChange(
                      item.label.toLowerCase().includes("team")
                        ? "team"
                        : item.label.toLowerCase().includes("chat")
                          ? "chat"
                          : item.label.toLowerCase().includes("payment")
                            ? "payment"
                            : item.label.toLowerCase().includes("support")
                              ? "support"
                              : item.label.toLowerCase().includes("welcome") || item.label.toLowerCase().includes("product")
                                ? "notification"
                                : activeFilter
                    )}
                  >
                    <span>{item.label}</span>
                    <div className="workspace-radar-bar">
                      <i className="workspace-radar-fill" style={{ width: `${(item.value / maxRadarValue) * 100}%` }} />
                    </div>
                    <strong>{item.value}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="status-item status-info">No activity radar data yet.</p>
            )}
          </article>
        </aside>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="workspace-command-toolbar">
        <div className="workspace-filter-strip">
          {filterButtons.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`workspace-filter-pill ${activeFilter === item.key ? "is-active" : ""}`}
              onClick={() => handleFilterChange(item.key)}
            >
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>

        <label className="workspace-search-shell">
          <span>Find records fast</span>
          <input
            type="text"
            className="workspace-input workspace-command-search"
            value={activityQuery}
            onChange={(event) => {
              const nextValue = event.target.value;
              setActivityQuery(nextValue);
              startTransition(() => {
                setSelectedActivityId("");
                setSelectedInspector(null);
              });
            }}
            placeholder="Search activity, chat titles, workspace names, support, billing..."
          />
        </label>
      </section>

      <section className="workspace-command-main">
        <article className="workspace-hub-card workspace-hub-card-square workspace-command-span-two">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Activity Stream</span>
              <h4>Everything worth attention right now</h4>
            </div>
            <span className="workspace-section-summary">{filteredRecentActivity.length} live matches</span>
          </div>
          {filteredRecentActivity.length > 0 ? (
            <div className="workspace-activity-stream">
              {filteredRecentActivity.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-stream-item workspace-card-button ${selectedActivityId === item.id ? "is-active" : ""}`}
                  onClick={() => handleActivitySelect(item)}
                >
                  <div className="workspace-stream-rail" />
                  <div className="workspace-stream-content">
                    <div className="workspace-stream-head">
                      <span className="workspace-stream-chip">{normalizeCategoryLabel(item.category)}</span>
                      <span className="workspace-stream-time">{formatTimestamp(item.createdAt)}</span>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="status-item status-info">No dashboard activity matches the current filter.</p>
          )}
        </article>

        <article className="workspace-hub-card workspace-hub-card-square workspace-lane-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Execution Lanes</span>
              <h4>Switch between operating lanes</h4>
            </div>
          </div>
          <div className="workspace-lane-grid">
            {collections.map((collection) => {
              const filteredCount = filteredCollections.find((item) => item.accent === collection.accent)?.filteredItems.length || 0;
              return (
                <button
                  key={collection.title}
                  type="button"
                  className={`workspace-lane-tile workspace-card-button is-${collection.accent} ${selectedCollectionAccent === collection.accent ? "is-active" : ""}`}
                  onClick={() => handleCollectionFocus(collection.accent)}
                >
                  <span>{collection.title}</span>
                  <strong>{filteredCount}</strong>
                  <p>{collection.subtitle}</p>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <section className="workspace-focus-grid">
        <article className="workspace-hub-card workspace-hub-card-square workspace-focus-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Live Inspector</span>
              <h4>Selected record details</h4>
            </div>
            <span className="workspace-section-summary">{inspectorRecord?.category || "Waiting"}</span>
          </div>
          {inspectorRecord ? (
            <div className="workspace-focus-record">
              <span className="workspace-focus-eyebrow">{inspectorRecord.source === "activity" ? "Activity signal" : "Collection record"}</span>
              <strong>{inspectorRecord.title}</strong>
              <p>{inspectorRecord.detail}</p>
              <div className="workspace-focus-meta">
                <span>{inspectorRecord.meta}</span>
                <span>{formatTimestamp(inspectorRecord.createdAt)}</span>
              </div>
            </div>
          ) : (
            <p className="workspace-collection-empty">Select an activity or collection item to inspect it here.</p>
          )}
        </article>

        <article className="workspace-hub-card workspace-hub-card-square workspace-focus-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Focused Lane</span>
              <h4>{focusedCollection?.title || "Workspace records"}</h4>
            </div>
            <span className="workspace-section-summary">{focusedCollection?.filteredItems.length || 0}</span>
          </div>
          {focusedCollection?.filteredItems.length > 0 ? (
            <div className="workspace-focus-preview-list">
              {focusedCollection.filteredItems.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-focus-preview-item workspace-card-button ${selectedInspector?.id === item.id ? "is-active" : ""}`}
                  onClick={() => handleCollectionSelect(focusedCollection.accent, item)}
                >
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <span>{item.meta || "Workspace record"}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="workspace-collection-empty">{focusedCollection?.emptyText || "No matching records in this lane yet."}</p>
          )}
        </article>
      </section>

      <section className="workspace-collection-grid">
        {filteredCollections.map((collection) => (
          <article
            key={collection.title}
            className={`workspace-hub-card workspace-hub-card-square workspace-collection-card is-${collection.accent} ${selectedCollectionAccent === collection.accent ? "is-active" : ""}`}
          >
            <div className="workspace-section-heading">
              <div>
                <span className="workspace-command-kicker">{collection.title}</span>
                <h4>{collection.subtitle}</h4>
              </div>
              <button
                type="button"
                className="workspace-inline-action"
                onClick={() => handleCollectionFocus(collection.accent)}
              >
                Focus
              </button>
            </div>

            {collection.filteredItems.length > 0 ? (
              <div className="workspace-collection-list">
                {collection.filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`workspace-collection-item workspace-card-button ${selectedInspector?.id === item.id ? "is-active" : ""}`}
                    onClick={() => handleCollectionSelect(collection.accent, item)}
                  >
                    <div className="workspace-collection-stack">
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      {item.meta ? <span className="workspace-collection-meta">{item.meta}</span> : null}
                    </div>
                    <span className="workspace-collection-timestamp">{formatTimestamp(item.createdAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="workspace-collection-empty">{normalizedQuery ? "No records match the current search." : collection.emptyText}</p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

export default DashboardPanel;
