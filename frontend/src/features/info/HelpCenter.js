import React, { useEffect, useMemo, useState } from "react";

import { createContactRequest, listContactRequests } from "./contactApi";

const HELP_SECTIONS = [
  { id: "docs", label: "Help Docs" },
  { id: "bug", label: "Report Bug" },
  { id: "feature", label: "Request Feature" },
  { id: "history", label: "Support History" },
];

const HELP_DOCS = [
  {
    title: "Getting started",
    detail: "Complete your profile, upload a first document, open pricing, and invite a teammate from the workspace.",
  },
  {
    title: "Document workflow",
    detail: "Upload a supported file, ask a focused question, and review the answer and source-aware status updates.",
  },
  {
    title: "Billing and subscriptions",
    detail: "Choose a plan in Pricing, complete Razorpay checkout, and review verified payment history in account surfaces.",
  },
  {
    title: "Team operations",
    detail: "Create a team workspace, invite a user, and manage roles from the team management panel.",
  },
];

function HelpCenter({ currentUser = null }) {
  const [section, setSection] = useState("docs");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [formState, setFormState] = useState({
    fullName: currentUser?.fullName || currentUser?.name || "",
    email: currentUser?.email || "",
    title: "",
    message: "",
  });
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  useEffect(() => {
    if (section !== "history" || !currentUser?.id) {
      return;
    }
    let active = true;

    async function loadHistory() {
      try {
        setLoadingHistory(true);
        const items = await listContactRequests(currentUser.id);
        if (active) {
          setHistory(items || []);
        }
      } catch (error) {
        if (active) {
          setFeedback({ type: "error", text: error.message || "Failed to load support history." });
        }
      } finally {
        if (active) {
          setLoadingHistory(false);
        }
      }
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, [section, currentUser?.id]);

  const selectedDocs = useMemo(() => HELP_DOCS, []);

  const submitTicket = async (category) => {
    try {
      await createContactRequest({
        category,
        title: formState.title || (category === "technical" ? "Bug report" : "Feature request"),
        values: {
          fullName: formState.fullName,
          email: formState.email,
          message: formState.message,
        },
      });
      setFeedback({ type: "success", text: `${category === "technical" ? "Bug report" : "Feature request"} submitted successfully.` });
      setFormState((current) => ({ ...current, title: "", message: "" }));
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Failed to submit the request." });
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.pillRow}>
        {HELP_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            style={{
              ...styles.pill,
              ...(section === item.id ? styles.pillActive : {}),
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {feedback.text ? <p style={feedback.type === "success" ? styles.successText : styles.errorText}>{feedback.text}</p> : null}

      {section === "docs" ? (
        <section style={styles.panel}>
          <span style={styles.eyebrow}>Help Center</span>
          <h2 style={styles.title}>Support docs that match the current workspace flow</h2>
          <div style={styles.grid}>
            {selectedDocs.map((item) => (
              <article key={item.title} style={styles.card}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {["bug", "feature"].includes(section) ? (
        <section style={styles.panel}>
          <span style={styles.eyebrow}>{section === "bug" ? "Report Bug" : "Request Feature"}</span>
          <h2 style={styles.title}>{section === "bug" ? "Log a product issue cleanly" : "Submit a feature request with context"}</h2>
          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Full name" value={formState.fullName} onChange={(e) => setFormState((current) => ({ ...current, fullName: e.target.value }))} />
            <input style={styles.input} placeholder="Email" value={formState.email} onChange={(e) => setFormState((current) => ({ ...current, email: e.target.value }))} />
            <input style={{ ...styles.input, gridColumn: "1 / -1" }} placeholder="Title" value={formState.title} onChange={(e) => setFormState((current) => ({ ...current, title: e.target.value }))} />
            <textarea style={styles.textarea} rows={6} placeholder={section === "bug" ? "Describe the issue, expected result, and what happened instead." : "Describe the feature, who it helps, and why it matters."} value={formState.message} onChange={(e) => setFormState((current) => ({ ...current, message: e.target.value }))} />
            <button type="button" style={styles.primaryButton} onClick={() => submitTicket(section === "bug" ? "technical" : "feedback")}>
              {section === "bug" ? "Submit Bug Report" : "Submit Feature Request"}
            </button>
          </div>
        </section>
      ) : null}

      {section === "history" ? (
        <section style={styles.panel}>
          <span style={styles.eyebrow}>Support History</span>
          <h2 style={styles.title}>Previous requests tied to this account</h2>
          {loadingHistory ? (
            <p style={styles.body}>Loading support history...</p>
          ) : history.length > 0 ? (
            <div style={styles.stack}>
              {history.map((item) => (
                <article key={item.id} style={styles.card}>
                  <strong>{item.title}</strong>
                  <p>{item.category} | {item.status}</p>
                  <span style={styles.meta}>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Just now"}</span>
                </article>
              ))}
            </div>
          ) : (
            <p style={styles.body}>No support requests recorded yet.</p>
          )}
        </section>
      ) : null}
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
  body: { margin: 0, color: "#5d6a80", lineHeight: 1.8 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "20px" },
  stack: { display: "grid", gap: "16px", marginTop: "20px" },
  card: { borderRadius: "20px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)", padding: "18px", display: "grid", gap: "8px", color: "#4e5f79" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px", marginTop: "20px" },
  input: { width: "100%", borderRadius: "14px", border: "1px solid #cfdaec", padding: "12px 14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box" },
  textarea: { gridColumn: "1 / -1", width: "100%", borderRadius: "16px", border: "1px solid #cfdaec", padding: "14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box", resize: "vertical" },
  primaryButton: { border: "none", borderRadius: "14px", background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", padding: "14px 18px", cursor: "pointer", fontWeight: 700, width: "fit-content" },
  meta: { color: "#7b88a0", fontSize: "13px" },
  successText: { color: "#0f6a3e", margin: 0, fontWeight: 600 },
  errorText: { color: "#9f3f3f", margin: 0, fontWeight: 600 },
};

export default HelpCenter;
