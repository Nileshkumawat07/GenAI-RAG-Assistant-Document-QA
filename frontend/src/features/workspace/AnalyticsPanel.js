import React from "react";

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

  const renderBreakdown = (items, emptyText, fallbackText) => (
    items.length > 0 ? (
      <div className="workspace-hub-list">
        {items.map((item) => (
          <article key={item.label} className="workspace-hub-list-item workspace-hub-list-item-square">
            <div>
              <strong>{item.label}</strong>
              <p>{item.hint || fallbackText}</p>
            </div>
            <span>{item.value}</span>
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
          <h3>Analytics</h3>
          <p>See the full activity picture for chats, teams, notifications, support, and billing.</p>
        </div>
        <button type="button" className="hero-button hero-button-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-grid">
        {Object.entries(headline).map(([key, value]) => (
          <article key={key} className="workspace-hub-card workspace-hub-card-square">
            <span className="workspace-hub-eyebrow">{key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="workspace-hub-grid">
        {activityMix.map((item) => (
          <article key={item.label} className="workspace-hub-card workspace-hub-card-square workspace-hub-card-compact">
            <span className="workspace-hub-eyebrow">{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.hint || "No additional detail."}</p>
          </article>
        ))}
      </div>

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Chat Activity</h4>
          <div className="workspace-analytics-bars">
            {chatActivity.map((item) => (
              <div key={`chat-${item.label}`} className="workspace-analytics-row">
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Notification Activity</h4>
          <div className="workspace-analytics-bars">
            {notificationActivity.map((item) => (
              <div key={`notification-${item.label}`} className="workspace-analytics-row">
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(item.value * 16, 8)}px` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="workspace-hub-card workspace-hub-card-square">
        <h4>Weekly Activity Timeline</h4>
        {weeklyTimeline.length > 0 ? (
          <div className="workspace-hub-list">
            {weeklyTimeline.map((item) => (
              <article key={item.label} className="workspace-hub-list-item workspace-hub-list-item-square">
                <div>
                  <strong>{item.label}</strong>
                  <p>Chats {item.chats} | Messages {item.messages} | Notifications {item.notifications}</p>
                  <span className="workspace-hub-inline-meta">
                    Teams {item.teams} | Support {item.supportRequests} | Payments {item.payments}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="status-item status-info">No weekly timeline data yet.</p>
        )}
      </section>

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Role Distribution</h4>
          {renderBreakdown(teamRoleDistribution, "No team role data yet.", "Workspace access role")}
        </section>

        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Notification Categories</h4>
          {renderBreakdown(notificationCategoryBreakdown, "No notification category data yet.", "Notification category volume")}
        </section>
      </div>

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Support Status Breakdown</h4>
          {renderBreakdown(supportStatusBreakdown, "No support requests recorded yet.", "Support request count")}
        </section>

        <section className="workspace-hub-card workspace-hub-card-square">
          <h4>Payment Status Breakdown</h4>
          {renderBreakdown(paymentStatusBreakdown, "No payment status data yet.", "Payment event count")}
        </section>
      </div>

      <section className="workspace-hub-card workspace-hub-card-square">
        <h4>Team Distribution</h4>
        {teamDistribution.length > 0 ? (
          <div className="workspace-hub-list">
            {teamDistribution.map((item) => (
              <article key={item.label} className="workspace-hub-list-item workspace-hub-list-item-square">
                <div>
                  <strong>{item.label}</strong>
                  <p>Members with access to this workspace.</p>
                </div>
                <span>{item.value}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="status-item status-info">Create a team to start seeing distribution metrics.</p>
        )}
      </section>
    </div>
  );
}

export default AnalyticsPanel;
