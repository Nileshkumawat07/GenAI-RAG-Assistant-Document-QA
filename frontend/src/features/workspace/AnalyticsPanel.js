import React, { startTransition, useState } from "react";

function formatLabel(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function totalTimelineValue(item) {
  return item.chats + item.messages + item.notifications + item.teams + item.supportRequests + item.payments;
}

function calculateShare(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function metricWidth(value, total, maxValue, mode) {
  if (!value) {
    return 0;
  }
  if (mode === "share") {
    return Math.max(calculateShare(value, total), 6);
  }
  return Math.max((value / Math.max(maxValue, 1)) * 100, 6);
}

function mapHeadlineKeyToDomain(key) {
  return {
    chatThreads: "Threads",
    messagesSaved: "Messages",
    notificationsReceived: "Notifications",
    teamsAvailable: "Teams",
    supportRequests: "Support",
    paymentsLogged: "Payments",
  }[key] || "";
}

function AnalyticsPanel({ data, loading, error, onRefresh }) {
  const headline = data?.headline || {};
  const chatActivity = data?.chatActivity || [];
  const notificationActivity = data?.notificationActivity || [];
  const teamDistribution = data?.teamDistribution || [];
  const activityMix = data?.activityMix || [];
  const teamRoleDistribution = data?.teamRoleDistribution || [];
  const notificationCategoryBreakdown = data?.notificationCategoryBreakdown || [];
  const supportStatusBreakdown = data?.supportStatusBreakdown || [];
  const paymentStatusBreakdown = data?.paymentStatusBreakdown || [];
  const weeklyTimeline = data?.weeklyTimeline || [];

  const headlineEntries = Object.entries(headline);
  const mixTotal = activityMix.reduce((sum, item) => sum + item.value, 0);
  const mixMax = Math.max(...activityMix.map((item) => item.value), 1);
  const maxTeamValue = Math.max(...teamDistribution.map((entry) => entry.value), 1);
  const timelinePeak = weeklyTimeline.reduce(
    (best, item) => (totalTimelineValue(item) > totalTimelineValue(best) ? item : best),
    weeklyTimeline[0] || { label: "No peak", chats: 0, messages: 0, notifications: 0, teams: 0, supportRequests: 0, payments: 0 }
  );
  const timelineMax = Math.max(...weeklyTimeline.map((item) => totalTimelineValue(item)), 1);
  const dominantDomain = [...activityMix].sort((left, right) => right.value - left.value)[0] || null;
  const breakdownCards = [
    {
      title: "Role Distribution",
      subtitle: "Ownership and management coverage across workspace access.",
      items: teamRoleDistribution,
      emptyText: "No team role data yet.",
      fallbackText: "Workspace access role",
    },
    {
      title: "Notification Categories",
      subtitle: "How alert volume is distributed across workspace event types.",
      items: notificationCategoryBreakdown,
      emptyText: "No notification category data yet.",
      fallbackText: "Notification category volume",
    },
    {
      title: "Support Status Breakdown",
      subtitle: "Service request maturity from open queue to closure.",
      items: supportStatusBreakdown,
      emptyText: "No support requests recorded yet.",
      fallbackText: "Support request count",
    },
    {
      title: "Payment Status Breakdown",
      subtitle: "Commercial health across subscription and payment events.",
      items: paymentStatusBreakdown,
      emptyText: "No payment status data yet.",
      fallbackText: "Payment event count",
    },
  ];

  const [metricMode, setMetricMode] = useState("volume");
  const [activeDomainState, setActiveDomainState] = useState("");
  const [selectedTimelineLabelState, setSelectedTimelineLabelState] = useState("");
  const [selectedBreakdownTitleState, setSelectedBreakdownTitleState] = useState("");
  const [selectedTeamLabelState, setSelectedTeamLabelState] = useState("");

  const activeDomain = activityMix.some((item) => item.label === activeDomainState)
    ? activeDomainState
    : dominantDomain?.label || activityMix[0]?.label || "";
  const activeBreakdownTitle = breakdownCards.some((card) => card.title === selectedBreakdownTitleState)
    ? selectedBreakdownTitleState
    : breakdownCards[0]?.title || "";
  const selectedTimelineLabel = weeklyTimeline.some((item) => item.label === selectedTimelineLabelState)
    ? selectedTimelineLabelState
    : timelinePeak.label;
  const selectedTeamLabel = teamDistribution.some((item) => item.label === selectedTeamLabelState)
    ? selectedTeamLabelState
    : teamDistribution[0]?.label || "";

  const activeDomainEntry = activityMix.find((item) => item.label === activeDomain) || dominantDomain;
  const activeBreakdown = breakdownCards.find((card) => card.title === activeBreakdownTitle) || breakdownCards[0] || null;
  const selectedTimelineItem = weeklyTimeline.find((item) => item.label === selectedTimelineLabel) || timelinePeak;
  const selectedTeam = teamDistribution.find((item) => item.label === selectedTeamLabel) || teamDistribution[0] || null;
  const breakdownLeader = activeBreakdown?.items?.[0] || null;

  const renderBreakdownCard = ({ title, subtitle, items, emptyText, fallbackText }) => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const maxValue = Math.max(...items.map((item) => item.value), 1);
    const isActive = title === activeBreakdownTitle;

    return (
      <article key={title} className={`workspace-hub-card workspace-hub-card-square workspace-breakdown-card ${isActive ? "is-active" : ""}`}>
        <div className="workspace-section-heading">
          <div>
            <span className="workspace-command-kicker">{title}</span>
            <h4>{subtitle}</h4>
          </div>
          <span className="workspace-section-summary">{total}</span>
        </div>
        {items.length > 0 ? (
          <div className="workspace-breakdown-list">
            {items.map((item) => (
              <article key={item.label} className="workspace-breakdown-item">
                <div className="workspace-breakdown-head">
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
                <p>{item.hint || fallbackText}</p>
                <div className="workspace-breakdown-meter">
                  <i style={{ width: `${metricWidth(item.value, total, maxValue, metricMode)}%` }} />
                </div>
                <span className="workspace-breakdown-share">
                  {metricMode === "share" ? `${calculateShare(item.value, total)}%` : `${item.value}`}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="workspace-collection-empty">{emptyText}</p>
        )}
      </article>
    );
  };

  return (
    <div className="workspace-premium-shell workspace-analytics-shell">
      <section className="workspace-analytics-hero">
        <article className="workspace-hub-card workspace-hub-card-square workspace-analytics-brief">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Executive Readout</span>
              <h3 className="workspace-command-title">Operational analytics fabric</h3>
              <p className="workspace-command-lede">
                A premium intelligence layer showing flow, volume, concentration, and momentum across every user activity surface.
              </p>
            </div>
            <button type="button" className="hero-button hero-button-secondary workspace-command-refresh" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="workspace-command-badge-row workspace-analytics-badge-row">
            <div className="workspace-command-badge">
              <span>Peak Day</span>
              <strong>{timelinePeak.label}</strong>
              <p>{totalTimelineValue(timelinePeak)} total tracked events</p>
            </div>
            <div className="workspace-command-badge">
              <span>Dominant Domain</span>
              <strong>{dominantDomain?.label || "No data"}</strong>
              <p>{dominantDomain ? `${dominantDomain.value} tracked actions` : "Waiting for activity"}</p>
            </div>
            <div className="workspace-command-badge">
              <span>Tracked Volume</span>
              <strong>{mixTotal}</strong>
              <p>Combined chat, support, payment, and notification signals</p>
            </div>
          </div>
        </article>

        <div className="workspace-analytics-scoreboard">
          {headlineEntries.map(([key, value]) => {
            const mappedDomain = mapHeadlineKeyToDomain(key);
            const isActive = mappedDomain && mappedDomain === activeDomain;

            return (
              <button
                key={key}
                type="button"
                className={`workspace-hub-card workspace-hub-card-square workspace-analytics-scorecard workspace-card-button ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  if (!mappedDomain) {
                    return;
                  }
                  startTransition(() => {
                    setActiveDomainState(mappedDomain);
                  });
                }}
              >
                <span className="workspace-hub-eyebrow">{formatLabel(key)}</span>
                <strong>{value}</strong>
              </button>
            );
          })}
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="workspace-analytics-control-bar">
        <div className="workspace-filter-strip">
          {activityMix.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`workspace-filter-pill ${activeDomain === item.label ? "is-active" : ""}`}
              onClick={() => {
                startTransition(() => {
                  setActiveDomainState(item.label);
                });
              }}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>

        <div className="workspace-toggle-strip">
          <button
            type="button"
            className={`workspace-toggle-button ${metricMode === "volume" ? "is-active" : ""}`}
            onClick={() => startTransition(() => setMetricMode("volume"))}
          >
            Volume mode
          </button>
          <button
            type="button"
            className={`workspace-toggle-button ${metricMode === "share" ? "is-active" : ""}`}
            onClick={() => startTransition(() => setMetricMode("share"))}
          >
            Share mode
          </button>
        </div>

        <div className="workspace-toggle-strip workspace-breakdown-nav">
          {breakdownCards.map((card) => (
            <button
              key={card.title}
              type="button"
              className={`workspace-toggle-button ${activeBreakdownTitle === card.title ? "is-active" : ""}`}
              onClick={() => {
                startTransition(() => {
                  setSelectedBreakdownTitleState(card.title);
                });
              }}
            >
              {card.title}
            </button>
          ))}
        </div>
      </section>

      <section className="workspace-analytics-focus-grid">
        <article className="workspace-hub-card workspace-hub-card-square workspace-analytics-focus-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Interactive Focus</span>
              <h4>Selected operating narrative</h4>
            </div>
            <span className="workspace-section-summary">{activeDomainEntry?.label || "No domain"}</span>
          </div>
          <div className="workspace-analytics-focus-stats">
            <div className="workspace-focus-stat">
              <span>Domain volume</span>
              <strong>{activeDomainEntry?.value || 0}</strong>
              <p>{activeDomainEntry?.hint || "No domain details available yet."}</p>
            </div>
            <div className="workspace-focus-stat">
              <span>Domain share</span>
              <strong>{activeDomainEntry ? `${calculateShare(activeDomainEntry.value, mixTotal)}%` : "0%"}</strong>
              <p>Share of all tracked workspace activity.</p>
            </div>
            <div className="workspace-focus-stat">
              <span>Selected day</span>
              <strong>{selectedTimelineItem?.label || "No day"}</strong>
              <p>{selectedTimelineItem ? `${totalTimelineValue(selectedTimelineItem)} events on this day` : "No day selected yet."}</p>
            </div>
            <div className="workspace-focus-stat">
              <span>Breakdown leader</span>
              <strong>{breakdownLeader?.label || "No leader"}</strong>
              <p>{breakdownLeader ? `${breakdownLeader.value} records in the active breakdown view.` : "No breakdown leader yet."}</p>
            </div>
          </div>
          <div className="workspace-analytics-focus-meta">
            <span>Team lens: {selectedTeam?.label || "No team data"}</span>
            <span>{selectedTeam ? `${selectedTeam.value} members in focus` : "No member footprint yet"}</span>
          </div>
        </article>
      </section>

      <section className="workspace-analytics-band">
        <article className="workspace-hub-card workspace-hub-card-square workspace-analytics-mix-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Activity Mix</span>
              <h4>Where workload concentrates</h4>
            </div>
            <span className="workspace-section-summary">{mixTotal}</span>
          </div>
          <div className="workspace-mix-list">
            {activityMix.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`workspace-mix-row workspace-card-button ${activeDomain === item.label ? "is-active" : ""}`}
                onClick={() => {
                  startTransition(() => {
                    setActiveDomainState(item.label);
                  });
                }}
              >
                <div className="workspace-mix-topline">
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
                <p>{item.hint || "No additional detail."}</p>
                <div className="workspace-mix-bar">
                  <i className="workspace-mix-fill" style={{ width: `${metricWidth(item.value, mixTotal, mixMax, metricMode)}%` }} />
                </div>
                <span className="workspace-mix-share">
                  {metricMode === "share" ? `${calculateShare(item.value, mixTotal)}%` : `${item.value}`}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="workspace-hub-card workspace-hub-card-square workspace-timeline-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Daily Momentum</span>
              <h4>Weekly operating pulse</h4>
            </div>
            <span className="workspace-section-summary">{selectedTimelineLabel}</span>
          </div>
          {weeklyTimeline.length > 0 ? (
            <div className="workspace-timeline-list">
              {weeklyTimeline.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`workspace-timeline-row workspace-card-button ${selectedTimelineLabel === item.label ? "is-active" : ""}`}
                  onClick={() => {
                    startTransition(() => {
                      setSelectedTimelineLabelState(item.label);
                    });
                  }}
                >
                  <div className="workspace-timeline-header">
                    <strong>{item.label}</strong>
                    <span className="workspace-timeline-total">{totalTimelineValue(item)} events</span>
                  </div>
                  <div className="workspace-timeline-meters">
                    <i className="workspace-timeline-meter is-chats" style={{ width: `${Math.max((item.chats / timelineMax) * 100, item.chats ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-messages" style={{ width: `${Math.max((item.messages / timelineMax) * 100, item.messages ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-notifications" style={{ width: `${Math.max((item.notifications / timelineMax) * 100, item.notifications ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-teams" style={{ width: `${Math.max((item.teams / timelineMax) * 100, item.teams ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-support" style={{ width: `${Math.max((item.supportRequests / timelineMax) * 100, item.supportRequests ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-payments" style={{ width: `${Math.max((item.payments / timelineMax) * 100, item.payments ? 5 : 0)}%` }} />
                  </div>
                  <div className="workspace-timeline-meta">
                    <span>Chats {item.chats}</span>
                    <span>Msgs {item.messages}</span>
                    <span>Notif {item.notifications}</span>
                    <span>Teams {item.teams}</span>
                    <span>Support {item.supportRequests}</span>
                    <span>Pay {item.payments}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="workspace-collection-empty">No weekly timeline data yet.</p>
          )}
        </article>
      </section>

      <section className="workspace-analytics-trends">
        <article className="workspace-hub-card workspace-hub-card-square workspace-analytics-chart-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Chat Trend</span>
              <h4>Saved message flow</h4>
            </div>
          </div>
          <div className="workspace-analytics-bars">
            {chatActivity.map((item) => (
              <button
                key={`chat-${item.label}`}
                type="button"
                className={`workspace-analytics-row workspace-card-button ${selectedTimelineLabel === item.label ? "is-active" : ""}`}
                onClick={() => {
                  startTransition(() => {
                    setSelectedTimelineLabelState(item.label);
                    setActiveDomainState("Messages");
                  });
                }}
              >
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="workspace-hub-card workspace-hub-card-square workspace-analytics-chart-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Alert Trend</span>
              <h4>Notification throughput</h4>
            </div>
          </div>
          <div className="workspace-analytics-bars">
            {notificationActivity.map((item) => (
              <button
                key={`notification-${item.label}`}
                type="button"
                className={`workspace-analytics-row workspace-card-button ${selectedTimelineLabel === item.label ? "is-active" : ""}`}
                onClick={() => {
                  startTransition(() => {
                    setSelectedTimelineLabelState(item.label);
                    setActiveDomainState("Notifications");
                  });
                }}
              >
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace-breakdown-grid">
        {breakdownCards.map(renderBreakdownCard)}
      </section>

      <section className="workspace-hub-card workspace-hub-card-square workspace-team-leaderboard-card">
        <div className="workspace-section-heading">
          <div>
            <span className="workspace-command-kicker">Access Leaderboard</span>
            <h4>Team distribution by member footprint</h4>
          </div>
          <span className="workspace-section-summary">{selectedTeam?.label || "No team"}</span>
        </div>
        {teamDistribution.length > 0 ? (
          <div className="workspace-team-leaderboard">
            {teamDistribution.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`workspace-team-leader workspace-card-button ${selectedTeamLabel === item.label ? "is-active" : ""}`}
                onClick={() => {
                  startTransition(() => {
                    setSelectedTeamLabelState(item.label);
                    setActiveDomainState("Teams");
                  });
                }}
              >
                <div className="workspace-team-leader-head">
                  <strong>{item.label}</strong>
                  <span>{item.value} members</span>
                </div>
                <div className="workspace-team-leader-bar">
                  <i style={{ width: `${Math.max((item.value / maxTeamValue) * 100, 8)}%` }} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="workspace-collection-empty">Create a team to start seeing distribution metrics.</p>
        )}
      </section>
    </div>
  );
}

export default AnalyticsPanel;
