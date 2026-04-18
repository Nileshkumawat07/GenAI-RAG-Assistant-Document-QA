import React, { useMemo, useState } from "react";

const TRUST_SECTIONS = [
  {
    id: "privacy",
    label: "Privacy Policy",
    title: "Privacy policy built for a real production workspace",
    body: "We collect only the account, billing, workspace, and support data needed to run the product reliably, secure access, and improve service quality.",
    points: [
      "Profile and authentication details are stored to manage access, recovery, and account security.",
      "Billing and subscription records are stored for invoices, payment verification, and support follow-up.",
      "Workspace activity is retained to power notifications, saved threads, analytics, and account history.",
      "Users can request account deletion, export, and support review from the same workspace environment.",
    ],
  },
  {
    id: "terms",
    label: "Terms of Service",
    title: "Terms designed for teams, paid plans, and accountable usage",
    body: "Use of the platform requires lawful behavior, accurate account details, and responsible handling of uploaded content, team access, and payment flows.",
    points: [
      "Users remain responsible for the documents, prompts, and content they upload into the workspace.",
      "Paid plans activate after successful verification and follow the pricing and renewal rules shown in-product.",
      "Abuse, fraudulent activity, or attempts to bypass security controls may result in suspension or removal.",
      "Workspace collaboration features should only be used for authorized users and legitimate business or personal workflows.",
    ],
  },
  {
    id: "refunds",
    label: "Refund Policy",
    title: "Refund policy with clear commercial expectations",
    body: "Refund reviews are tied to payment status, activation timing, and whether the subscription or service has already been materially used.",
    points: [
      "Failed or duplicate charges are reviewed with priority and corrected where verified.",
      "Refund requests should include payment references, timeline context, and the reason for the request.",
      "Processed and verified premium activations may not always qualify for refunds after meaningful usage has started.",
      "Support will communicate review status, billing notes, and next steps through the workspace support flow.",
    ],
  },
  {
    id: "security",
    label: "Security",
    title: "Security posture users can review before rollout",
    body: "The workspace is structured around authenticated access, session validation, payment verification, and activity visibility across critical account actions.",
    points: [
      "Authentication, notifications, and account updates are tied to access token validation and user session checks.",
      "Billing events, support requests, and workspace actions are surfaced through visible account records and recent activity.",
      "Management and administration access use gated routes instead of being exposed to general users.",
      "Users are encouraged to use strong credentials, verified contact data, and immediate reporting for suspicious activity.",
    ],
  },
  {
    id: "status",
    label: "System Status",
    title: "Operational status users can read without leaving the app",
    body: "This status view communicates the expected condition of the major product lanes so users know what to check before escalating an issue.",
    points: [
      "Document retrieval should be available when uploads, indexing, and question flow complete normally.",
      "Chat, notifications, and team coordination should remain available for active authenticated sessions.",
      "Billing, pricing, and subscription history should stay visible for users with access to account data.",
      "If a lane fails, support can use this trust surface as the first diagnostic checkpoint before deeper investigation.",
    ],
  },
];

function TrustCenter() {
  const [selectedSection, setSelectedSection] = useState("privacy");
  const currentSection = useMemo(
    () => TRUST_SECTIONS.find((section) => section.id === selectedSection) || TRUST_SECTIONS[0],
    [selectedSection]
  );

  return (
    <div style={styles.page}>
      <div style={styles.pillRow}>
        {TRUST_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setSelectedSection(section.id)}
            style={{
              ...styles.pill,
              ...(selectedSection === section.id ? styles.pillActive : {}),
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      <section style={styles.panel}>
        <span style={styles.eyebrow}>Trust Center</span>
        <h2 style={styles.title}>{currentSection.title}</h2>
        <p style={styles.body}>{currentSection.body}</p>

        <div style={styles.grid}>
          {currentSection.points.map((item) => (
            <article key={item} style={styles.card}>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  pillRow: { display: "flex", flexWrap: "wrap", gap: "12px" },
  pill: { padding: "14px 22px", borderRadius: "999px", border: "1px solid #c6d3eb", background: "#f8fbff", color: "#22406f", cursor: "pointer", fontWeight: 700 },
  pillActive: { background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", borderColor: "#17315f" },
  panel: { borderRadius: "26px", border: "1px solid #dbe5f4", background: "#ffffff", padding: "24px", boxShadow: "0 16px 40px rgba(19,36,67,0.07)" },
  eyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#5b77a3", fontWeight: 700 },
  title: { margin: "12px 0 10px", fontSize: "34px", lineHeight: 1.1, color: "#17315f" },
  body: { margin: 0, color: "#5d6a80", lineHeight: 1.8, maxWidth: "840px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "22px" },
  card: { borderRadius: "20px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)", padding: "18px", color: "#4e5f79", lineHeight: 1.7 },
};

export default TrustCenter;
