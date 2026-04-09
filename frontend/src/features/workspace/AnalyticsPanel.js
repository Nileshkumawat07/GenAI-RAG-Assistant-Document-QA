import React from "react";

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

  const renderBreakdownCard = ({ title, subtitle, items, emptyText, fallbackText }) => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return (
      <article key={title} className="workspace-hub-card workspace-hub-card-square workspace-breakdown-card">
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
                  <i style={{ width: `${Math.max(calculateShare(item.value, total), 6)}%` }} />
                </div>
                <span className="workspace-breakdown-share">{calculateShare(item.value, total)}%</span>
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
          {headlineEntries.map(([key, value]) => (
            <article key={key} className="workspace-hub-card workspace-hub-card-square workspace-analytics-scorecard">
              <span className="workspace-hub-eyebrow">{formatLabel(key)}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

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
              <div key={item.label} className="workspace-mix-row">
                <div className="workspace-mix-topline">
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
                <p>{item.hint || "No additional detail."}</p>
                <div className="workspace-mix-bar">
                  <i className="workspace-mix-fill" style={{ width: `${Math.max(calculateShare(item.value, mixTotal), 6)}%` }} />
                </div>
                <span className="workspace-mix-share">{calculateShare(item.value, mixTotal)}%</span>
              </div>
            ))}
          </div>
        </article>

        <article className="workspace-hub-card workspace-hub-card-square workspace-timeline-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-command-kicker">Daily Momentum</span>
              <h4>Weekly operating pulse</h4>
            </div>
            <span className="workspace-section-summary">{timelinePeak.label}</span>
          </div>
          {weeklyTimeline.length > 0 ? (
            <div className="workspace-timeline-list">
              {weeklyTimeline.map((item) => (
                <article key={item.label} className="workspace-timeline-row">
                  <div className="workspace-timeline-header">
                    <strong>{item.label}</strong>
                    <span className="workspace-timeline-total">{totalTimelineValue(item)} events</span>
                  </div>
                  <div className="workspace-timeline-meters">
                    <i className="workspace-timeline-meter is-chats" style={{ width: `${Math.max((item.chats / timelineMax) * 100, item.chats ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-messages" style={{ width: `${Math.max((item.messages / timelineMax) * 100, item.messages ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-notifications" style={{ width: `${Math.max((item.notifications / timelineMax) * 100, item.notifications ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-support" style={{ width: `${Math.max((item.supportRequests / timelineMax) * 100, item.supportRequests ? 5 : 0)}%` }} />
                    <i className="workspace-timeline-meter is-payments" style={{ width: `${Math.max((item.payments / timelineMax) * 100, item.payments ? 5 : 0)}%` }} />
                  </div>
                  <div className="workspace-timeline-meta">
                    <span>Chats {item.chats}</span>
                    <span>Msgs {item.messages}</span>
                    <span>Notif {item.notifications}</span>
                    <span>Support {item.supportRequests}</span>
                    <span>Pay {item.payments}</span>
                  </div>
                </article>
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
              <div key={`chat-${item.label}`} className="workspace-analytics-row">
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </div>
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
              <div key={`notification-${item.label}`} className="workspace-analytics-row">
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </div>
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
        </div>
        {teamDistribution.length > 0 ? (
          <div className="workspace-team-leaderboard">
            {teamDistribution.map((item) => {
              return (
                <article key={item.label} className="workspace-team-leader">
                  <div className="workspace-team-leader-head">
                    <strong>{item.label}</strong>
                    <span>{item.value} members</span>
                  </div>
                  <div className="workspace-team-leader-bar">
                    <i style={{ width: `${Math.max((item.value / maxTeamValue) * 100, 8)}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="workspace-collection-empty">Create a team to start seeing distribution metrics.</p>
        )}
      </section>
    </div>
  );
}

export default AnalyticsPanel;
