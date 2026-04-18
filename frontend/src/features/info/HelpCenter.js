import React, { useEffect, useMemo, useState } from "react";

import { createContactRequest, listContactRequests } from "./contactApi";
import { pushToast } from "../../shared/toast/toastBus";

const HELP_SECTIONS = [
  { id: "docs", label: "Help Docs" },
  { id: "bug", label: "Report Bug" },
  { id: "feature", label: "Request Feature" },
  { id: "history", label: "Support History" },
];

const SUPPORT_CATEGORIES = [
  "Getting Started",
  "Billing",
  "Document Retrieval",
  "Image Generation",
  "Object Detection",
  "Team And Seats",
];

const HELP_DOCS = [
  {
    title: "Getting started",
    detail: "Complete your profile, upload a first document, open pricing, and invite a teammate from the workspace.",
    category: "Getting Started",
  },
  {
    title: "Document workflow",
    detail: "Upload a supported file, tag it by source, ask a focused question, and review the grounded answer history.",
    category: "Document Retrieval",
  },
  {
    title: "Billing and subscriptions",
    detail: "Choose a plan in Pricing, complete checkout, and monitor seats, storage, and usage from the profile usage center.",
    category: "Billing",
  },
  {
    title: "Creative and vision tools",
    detail: "Generate images or run detections, then watch limits and recent activity from the dashboard and profile panels.",
    category: "Image Generation",
  },
];

function HelpCenter({ currentUser = null }) {
  const [section, setSection] = useState("docs");
  const [selectedCategory, setSelectedCategory] = useState("Getting Started");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [formState, setFormState] = useState({
    fullName: currentUser?.fullName || currentUser?.name || "",
    email: currentUser?.email || "",
    title: "",
    message: "",
    category: "Document Retrieval",
  });

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
          pushToast({ type: "error", title: "History unavailable", message: error.message || "Failed to load support history." });
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

  const selectedDocs = useMemo(
    () => HELP_DOCS.filter((item) => selectedCategory === "Getting Started" || item.category === selectedCategory),
    [selectedCategory]
  );
  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") {
      return history;
    }

    return history.filter((item) => String(item.status || "").toLowerCase() === historyFilter);
  }, [history, historyFilter]);

  const submitTicket = async (category) => {
    try {
      await createContactRequest({
        category,
        title: formState.title || (category === "technical" ? "Bug report" : "Feature request"),
        values: {
          fullName: formState.fullName,
          email: formState.email,
          category: formState.category,
          message: formState.message,
        },
      });

      setFormState((current) => ({ ...current, title: "", message: "" }));
      pushToast({
        type: "success",
        title: category === "technical" ? "Bug report sent" : "Feature request sent",
        message: "Support has your request and it will appear in history shortly.",
      });
    } catch (error) {
      pushToast({ type: "error", title: "Submission failed", message: error.message || "Failed to submit the request." });
    }
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.eyebrow}>Help Center</span>
          <h2 style={styles.title}>A proper support hub for docs, bugs, feature requests, and past conversations.</h2>
          <p style={styles.body}>Pick a support lane, route requests by category, and keep a tidy history instead of scattering help flows across the app.</p>
        </div>
        <div style={styles.heroStats}>
          <div style={styles.heroStat}>
            <span>Support categories</span>
            <strong>{SUPPORT_CATEGORIES.length}</strong>
          </div>
          <div style={styles.heroStat}>
            <span>Saved history</span>
            <strong>{history.length}</strong>
          </div>
        </div>
      </section>

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

      {section === "docs" ? (
        <>
          <div style={styles.categoryRow}>
            {SUPPORT_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedCategory(item)}
                style={{
                  ...styles.categoryPill,
                  ...(selectedCategory === item ? styles.categoryPillActive : {}),
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <section style={styles.grid}>
            {selectedDocs.map((item) => (
              <article key={item.title} style={styles.card}>
                <span style={styles.cardTag}>{item.category}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>
        </>
      ) : null}

      {["bug", "feature"].includes(section) ? (
        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <div>
              <span style={styles.eyebrowAlt}>{section === "bug" ? "Report Bug" : "Request Feature"}</span>
              <h3 style={styles.panelTitle}>{section === "bug" ? "Capture the issue with enough context to reproduce it" : "Request a feature with user value and product context"}</h3>
            </div>
          </div>

          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Full name" value={formState.fullName} onChange={(e) => setFormState((current) => ({ ...current, fullName: e.target.value }))} />
            <input style={styles.input} placeholder="Email" value={formState.email} onChange={(e) => setFormState((current) => ({ ...current, email: e.target.value }))} />
            <select style={styles.input} value={formState.category} onChange={(e) => setFormState((current) => ({ ...current, category: e.target.value }))}>
              {SUPPORT_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input style={styles.input} placeholder="Short title" value={formState.title} onChange={(e) => setFormState((current) => ({ ...current, title: e.target.value }))} />
            <textarea style={styles.textarea} rows={6} placeholder={section === "bug" ? "What happened, what should have happened, and how can support reproduce it?" : "What should change, who benefits, and what workflow improves?"} value={formState.message} onChange={(e) => setFormState((current) => ({ ...current, message: e.target.value }))} />
            <button type="button" style={styles.primaryButton} onClick={() => submitTicket(section === "bug" ? "technical" : "feedback")}>
              {section === "bug" ? "Submit Bug Report" : "Submit Feature Request"}
            </button>
          </div>
        </section>
      ) : null}

      {section === "history" ? (
        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <div>
              <span style={styles.eyebrowAlt}>Support History</span>
              <h3 style={styles.panelTitle}>Review past conversations, statuses, and categories from one place.</h3>
            </div>
            <div style={styles.pillRow}>
              {[
                { id: "all", label: "All" },
                { id: "open", label: "Open" },
                { id: "in progress", label: "In Progress" },
                { id: "resolved", label: "Resolved" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHistoryFilter(item.id)}
                  style={{
                    ...styles.smallPill,
                    ...(historyFilter === item.id ? styles.smallPillActive : {}),
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loadingHistory ? (
            <p style={styles.body}>Loading support history...</p>
          ) : filteredHistory.length > 0 ? (
            <div style={styles.stack}>
              {filteredHistory.map((item) => (
                <article key={item.id} style={styles.card}>
                  <span style={styles.cardTag}>{item.category || "Support"}</span>
                  <strong>{item.title}</strong>
                  <p>{item.status || "Open"} • {item.values?.category || "General"}</p>
                  <span style={styles.meta}>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Just now"}</span>
                </article>
              ))}
            </div>
          ) : (
            <p style={styles.body}>No support requests match the current filter yet.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { borderRadius: "28px", border: "1px solid #dbe5f4", background: "linear-gradient(135deg, #17315f 0%, #245293 52%, #f8fbff 52%, #ffffff 100%)", padding: "24px", display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(220px, 0.7fr)", gap: "18px", alignItems: "start" },
  eyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#9eb9e9", fontWeight: 700 },
  eyebrowAlt: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#5b77a3", fontWeight: 700 },
  title: { margin: "12px 0 8px", fontSize: "34px", lineHeight: 1.08, color: "#ffffff" },
  body: { margin: 0, color: "#5d6a80", lineHeight: 1.8 },
  heroStats: { display: "grid", gap: "12px" },
  heroStat: { borderRadius: "22px", border: "1px solid #dbe5f4", background: "rgba(255,255,255,0.94)", padding: "18px", display: "grid", gap: "6px", color: "#17315f", boxShadow: "0 14px 30px rgba(16,34,61,0.08)" },
  pillRow: { display: "flex", flexWrap: "wrap", gap: "12px" },
  pill: { padding: "14px 22px", borderRadius: "999px", border: "1px solid #c6d3eb", background: "#f8fbff", color: "#22406f", cursor: "pointer", fontWeight: 700 },
  pillActive: { background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", borderColor: "#17315f" },
  categoryRow: { display: "flex", flexWrap: "wrap", gap: "10px" },
  categoryPill: { padding: "10px 16px", borderRadius: "999px", border: "1px solid #d6e0ef", background: "#ffffff", color: "#22406f", cursor: "pointer", fontWeight: 700 },
  categoryPillActive: { background: "#edf4ff", borderColor: "#8eb0e1" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" },
  stack: { display: "grid", gap: "16px" },
  panel: { borderRadius: "26px", border: "1px solid #dbe5f4", background: "#ffffff", padding: "24px", boxShadow: "0 16px 40px rgba(19,36,67,0.07)" },
  panelHead: { display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "start", marginBottom: "18px" },
  panelTitle: { margin: "10px 0 0", fontSize: "30px", lineHeight: 1.12, color: "#17315f", maxWidth: "760px" },
  card: { borderRadius: "20px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)", padding: "18px", display: "grid", gap: "8px", color: "#4e5f79" },
  cardTag: { display: "inline-flex", width: "fit-content", padding: "7px 11px", borderRadius: "999px", background: "#edf3ff", color: "#2c5797", fontSize: "12px", fontWeight: 700 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  input: { width: "100%", borderRadius: "14px", border: "1px solid #cfdaec", padding: "12px 14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box" },
  textarea: { gridColumn: "1 / -1", width: "100%", borderRadius: "16px", border: "1px solid #cfdaec", padding: "14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box", resize: "vertical" },
  primaryButton: { border: "none", borderRadius: "14px", background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", padding: "14px 18px", cursor: "pointer", fontWeight: 700, width: "fit-content" },
  meta: { color: "#7b88a0", fontSize: "13px" },
  smallPill: { padding: "10px 14px", borderRadius: "999px", border: "1px solid #d6e0ef", background: "#ffffff", color: "#23406d", cursor: "pointer", fontWeight: 700 },
  smallPillActive: { background: "#edf4ff", borderColor: "#84a7db" },
};

export default HelpCenter;
