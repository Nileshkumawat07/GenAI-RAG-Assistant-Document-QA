import React, { useMemo } from "react";

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 GB";
  }

  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

function getMetricValue(metrics, tokens, fallback = 0) {
  const match = (metrics || []).find((item) =>
    tokens.some((token) => String(item.label || "").toLowerCase().includes(token))
  );

  const rawValue = match?.value;
  if (typeof rawValue === "number") {
    return rawValue;
  }

  const parsedValue = Number(String(rawValue || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function UsageLimitsCenter({ currentUser, dashboard, analytics, teams }) {
  const planName = currentUser?.subscriptionPlanName || "Free Member";
  const subscriptionStatus = currentUser?.subscriptionStatus || "free";
  const isPremium = subscriptionStatus === "premium";

  const limits = useMemo(() => {
    if (isPremium) {
      return {
        storageBytes: 10 * 1024 ** 3,
        monthlyDocumentQueries: 600,
        imageGenerations: 180,
        detections: 240,
        teamSeats: 5,
      };
    }

    return {
      storageBytes: 2 * 1024 ** 3,
      monthlyDocumentQueries: 75,
      imageGenerations: 20,
      detections: 30,
      teamSeats: 1,
    };
  }, [isPremium]);

  const metrics = dashboard?.metrics || analytics?.metrics || [];
  const storageUsedBytes = Math.min(
    limits.storageBytes,
    Math.round(
      ((getMetricValue(metrics, ["storage"], 2.4) / 10) * limits.storageBytes)
      || (isPremium ? 2.4 * 1024 ** 3 : 0.7 * 1024 ** 3)
    )
  );
  const documentQueriesUsed = Math.min(
    limits.monthlyDocumentQueries,
    getMetricValue(metrics, ["document", "query"], isPremium ? 128 : 24)
  );
  const imageGenerationsUsed = Math.min(
    limits.imageGenerations,
    getMetricValue(metrics, ["image"], isPremium ? 46 : 8)
  );
  const detectionsUsed = Math.min(
    limits.detections,
    getMetricValue(metrics, ["detection", "vision"], isPremium ? 31 : 6)
  );
  const teamSeatsUsed = Math.min(
    limits.teamSeats,
    Math.max((teams || []).length, isPremium ? 3 : 1)
  );

  const cards = [
    {
      label: "Storage used",
      usedLabel: formatBytes(storageUsedBytes),
      limitLabel: formatBytes(limits.storageBytes),
      percent: clamp((storageUsedBytes / limits.storageBytes) * 100),
      detail: "Documents, generated assets, and workspace artifacts stored this billing cycle.",
    },
    {
      label: "Monthly document queries",
      usedLabel: documentQueriesUsed,
      limitLabel: limits.monthlyDocumentQueries,
      percent: clamp((documentQueriesUsed / limits.monthlyDocumentQueries) * 100),
      detail: "Grounded question-and-answer requests against indexed document context.",
    },
    {
      label: "Image generations",
      usedLabel: imageGenerationsUsed,
      limitLabel: limits.imageGenerations,
      percent: clamp((imageGenerationsUsed / limits.imageGenerations) * 100),
      detail: "Studio image requests processed during the current monthly window.",
    },
    {
      label: "Detections",
      usedLabel: detectionsUsed,
      limitLabel: limits.detections,
      percent: clamp((detectionsUsed / limits.detections) * 100),
      detail: "Visual analysis runs across uploaded and captured media.",
    },
    {
      label: "Team seats",
      usedLabel: teamSeatsUsed,
      limitLabel: limits.teamSeats,
      percent: clamp((teamSeatsUsed / limits.teamSeats) * 100),
      detail: "Collaborator slots available on the current workspace subscription.",
    },
  ];

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.eyebrow}>Usage And Limits</span>
          <h3 style={styles.title}>Keep product usage, seats, and storage visible before pricing becomes a surprise.</h3>
          <p style={styles.body}>
            {planName} is currently {isPremium ? "running with premium capacity." : "using the starter allocation."}
            Track the major usage lanes here so teams know when they are close to a limit.
          </p>
        </div>
        <div style={styles.heroBadge}>
          <span>Subscription</span>
          <strong>{planName}</strong>
          <small>{isPremium ? "Premium active" : "Starter access"}</small>
        </div>
      </section>

      <section style={styles.grid}>
        {cards.map((card) => (
          <article key={card.label} style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.cardLabel}>{card.label}</span>
              <strong style={styles.cardValue}>{card.usedLabel} / {card.limitLabel}</strong>
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${card.percent}%` }} />
            </div>
            <p style={styles.cardBody}>{card.detail}</p>
          </article>
        ))}
      </section>

      <section style={styles.summaryPanel}>
        <article style={styles.summaryCard}>
          <span style={styles.cardLabel}>Limit policy</span>
          <strong style={styles.summaryTitle}>Subscription limits</strong>
          <p style={styles.cardBody}>Limits reset monthly for usage-based lanes. Storage and seats remain tied to the active subscription package until you upgrade or archive data.</p>
        </article>
        <article style={styles.summaryCard}>
          <span style={styles.cardLabel}>Friendly heads-up</span>
          <strong style={styles.summaryTitle}>Plan before the cliff</strong>
          <p style={styles.cardBody}>When a lane passes 80%, it is probably time to archive stale files, reclaim seats, or move to a higher plan before work slows down.</p>
        </article>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "grid", gap: "18px" },
  hero: { borderRadius: "26px", border: "1px solid #dbe5f4", background: "linear-gradient(135deg, #17315f 0%, #245293 52%, #f7fbff 52%, #ffffff 100%)", padding: "24px", display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(220px, 0.7fr)", gap: "18px", alignItems: "start" },
  eyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#9db8e8", fontWeight: 700 },
  title: { margin: "12px 0 8px", color: "#ffffff", fontSize: "30px", lineHeight: 1.12, maxWidth: "620px" },
  body: { margin: 0, color: "#dce7ff", lineHeight: 1.8, maxWidth: "620px" },
  heroBadge: { borderRadius: "22px", background: "rgba(255,255,255,0.92)", border: "1px solid #dbe5f4", padding: "18px", display: "grid", gap: "6px", color: "#17315f", boxShadow: "0 16px 34px rgba(16,34,61,0.08)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" },
  card: { borderRadius: "22px", border: "1px solid #dbe5f4", background: "#ffffff", padding: "18px", display: "grid", gap: "12px", boxShadow: "0 14px 32px rgba(19,36,67,0.06)" },
  cardHead: { display: "grid", gap: "6px" },
  cardLabel: { fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#617da5", fontWeight: 700 },
  cardValue: { color: "#17315f", fontSize: "22px", lineHeight: 1.15 },
  progressTrack: { width: "100%", height: "10px", borderRadius: "999px", background: "#e8effa", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, #2d63b7 0%, #58a6d8 100%)" },
  cardBody: { margin: 0, color: "#5d6a80", lineHeight: 1.7 },
  summaryPanel: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" },
  summaryCard: { borderRadius: "22px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)", padding: "18px", display: "grid", gap: "10px" },
  summaryTitle: { color: "#17315f", fontSize: "24px", lineHeight: 1.15 },
};

export default UsageLimitsCenter;
