import React, { useEffect, useMemo, useState } from "react";

import {
  getManageContentEntries,
  getPublishedContentEntries,
  saveManagedContentEntry,
} from "./aboutContentApi";

const TRUST_SECTIONS = [
  {
    id: "privacy",
    label: "Privacy Policy",
    title: "Privacy policy that explains what the workspace stores and why.",
    body: "We collect only the account, billing, workspace, and support data required to operate the service, protect access, and improve reliability.",
    points: [
      "Profile, login, and recovery details support authentication and account security.",
      "Billing records are retained for invoices, payment verification, and refund review.",
      "Workspace activity supports notifications, analytics, saved threads, and support diagnostics.",
      "Deletion and export requests can be handled through the account and support flows.",
    ],
  },
  {
    id: "terms",
    label: "Terms of Service",
    title: "Terms that cover paid plans, team usage, and uploaded content.",
    body: "Using the platform means providing accurate account details, respecting payment rules, and uploading only content you are authorized to use.",
    points: [
      "Users remain responsible for documents, prompts, and content uploaded into the workspace.",
      "Paid plans activate after successful verification and follow the published pricing and renewal rules.",
      "Abuse, fraud, or attempts to bypass access controls can lead to suspension or termination.",
      "Collaboration and seat-based features should only be used by authorized teammates.",
    ],
  },
  {
    id: "refunds",
    label: "Refund Policy",
    title: "Refund guidance tied to verification, activation timing, and actual usage.",
    body: "Refund requests are reviewed against payment status, duplicate charges, activation windows, and whether the paid service has already been materially used.",
    points: [
      "Failed or duplicate charges are prioritized and corrected when verified.",
      "Refund requests should include payment references, timing, and the reason for the request.",
      "Premium plans that were successfully activated and meaningfully used may not be refundable.",
      "Support communicates the refund review status and next steps through the help center.",
    ],
  },
  {
    id: "security",
    label: "Security",
    title: "Security posture users can review before rollout.",
    body: "The product is organized around authenticated access, gated admin surfaces, visible activity records, and secure payment verification.",
    points: [
      "Critical account actions are tied to active session validation and authenticated APIs.",
      "Management and administration routes are gated instead of broadly exposed.",
      "Billing events, support requests, and recent activity remain visible for auditability.",
      "Users should still use strong credentials, verified contact channels, and immediate reporting for suspicious behavior.",
    ],
  },
  {
    id: "status",
    label: "Status",
    title: "Operational status that explains what product lanes should be healthy right now.",
    body: "This surface gives teams a quick trust check before escalating an issue, especially when billing, document retrieval, or notifications appear inconsistent.",
    points: [
      "Document retrieval should accept uploads, complete indexing, and return grounded answers normally.",
      "Chat, notifications, and team collaboration should stay available for active authenticated sessions.",
      "Pricing, billing, and subscription history should remain visible wherever account data is expected.",
      "If a lane is degraded, support can use this page as the first shared diagnostic checkpoint.",
    ],
  },
];

const DEFAULT_CONTENT_MAP = Object.fromEntries(TRUST_SECTIONS.map((section) => [section.id, section]));

function parseEntryPayload(entry) {
  try {
    return JSON.parse(entry?.bodyJson || "{}");
  } catch {
    return {};
  }
}

function linesToArray(value) {
  return (value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toDrafts(contentMap) {
  return Object.fromEntries(
    TRUST_SECTIONS.map((section) => [
      section.id,
      {
        title: contentMap[section.id]?.title || "",
        body: contentMap[section.id]?.body || "",
        points: (contentMap[section.id]?.points || []).join("\n"),
      },
    ])
  );
}

function TrustCenter({ canEdit = false }) {
  const [selectedSection, setSelectedSection] = useState("privacy");
  const [contentMap, setContentMap] = useState(DEFAULT_CONTENT_MAP);
  const [drafts, setDrafts] = useState(() => toDrafts(DEFAULT_CONTENT_MAP));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const currentSection = useMemo(
    () => contentMap[selectedSection] || DEFAULT_CONTENT_MAP[selectedSection] || TRUST_SECTIONS[0],
    [contentMap, selectedSection]
  );
  const previewSection = useMemo(() => ({
    ...currentSection,
    title: drafts[selectedSection]?.title || currentSection.title,
    body: drafts[selectedSection]?.body || currentSection.body,
    points: linesToArray(drafts[selectedSection]?.points || "").length > 0
      ? linesToArray(drafts[selectedSection]?.points || "")
      : currentSection.points || [],
  }), [currentSection, drafts, selectedSection]);

  useEffect(() => {
    let active = true;

    async function loadContent() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = canEdit
          ? await getManageContentEntries("trust")
          : await getPublishedContentEntries("trust");
        const entries = response?.entries || [];
        const nextMap = { ...DEFAULT_CONTENT_MAP };

        entries.forEach((entry) => {
          if (!nextMap[entry.sectionKey]) {
            return;
          }
          const payload = parseEntryPayload(entry);
          nextMap[entry.sectionKey] = {
            ...nextMap[entry.sectionKey],
            ...payload,
            title: payload.title || entry.title || nextMap[entry.sectionKey].title,
            body: payload.body || nextMap[entry.sectionKey].body,
            points: Array.isArray(payload.points) && payload.points.length > 0 ? payload.points : nextMap[entry.sectionKey].points,
          };
        });

        if (!active) {
          return;
        }
        setContentMap(nextMap);
        setDrafts(toDrafts(nextMap));
      } catch (error) {
        if (!active) {
          return;
        }
        setErrorMessage(error.message || "Failed to load trust content.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadContent();
    return () => {
      active = false;
    };
  }, [canEdit]);

  const handleSave = async () => {
    const sectionDraft = drafts[selectedSection] || {};
    const payload = {
      title: sectionDraft.title,
      body: sectionDraft.body,
      points: linesToArray(sectionDraft.points),
    };

    try {
      setSaving(true);
      setErrorMessage("");
      setStatusMessage("");
      await saveManagedContentEntry({
        pageKey: "trust",
        sectionKey: selectedSection,
        title: sectionDraft.title || TRUST_SECTIONS.find((section) => section.id === selectedSection)?.label || "Trust",
        bodyJson: JSON.stringify(payload),
        isPublished: true,
      });
      const nextMap = {
        ...contentMap,
        [selectedSection]: {
          ...contentMap[selectedSection],
          ...payload,
        },
      };
      setContentMap(nextMap);
      setDrafts(toDrafts(nextMap));
      setStatusMessage("Trust content published.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to save trust content.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.eyebrow}>Trust Center</span>
          <h2 style={styles.title}>Legal, security, and system trust pages collected into one product surface.</h2>
          <p style={styles.body}>If the app handles payments, account data, or team access, these pages need to feel first-class instead of hidden afterthoughts.</p>
        </div>
        <div style={styles.heroList}>
          {TRUST_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedSection(item.id)}
              style={{
                ...styles.heroLink,
                ...(selectedSection === item.id ? styles.heroLinkActive : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? <p style={styles.bodyAlt}>Loading trust content...</p> : null}
      {statusMessage ? <p style={styles.successText}>{statusMessage}</p> : null}
      {errorMessage ? <p style={styles.errorText}>{errorMessage}</p> : null}

      {!loading ? (
        <section style={styles.panel}>
          {canEdit ? (
            <div style={styles.editorHeader}>
              <div>
                <span style={styles.eyebrowAlt}>Trust Studio</span>
                <h3 style={styles.panelTitle}>Edit {currentSection.label}</h3>
              </div>
              <button type="button" onClick={handleSave} style={styles.primaryButton} disabled={saving}>
                {saving ? "Saving..." : "Publish Trust Content"}
              </button>
            </div>
          ) : (
            <>
              <span style={styles.eyebrowAlt}>{currentSection.label}</span>
              <h3 style={styles.panelTitle}>{currentSection.title}</h3>
            </>
          )}

          {canEdit ? (
            <div style={styles.editorGrid}>
              <div style={styles.editorPanel}>
                <input
                  style={styles.input}
                  value={drafts[selectedSection]?.title || ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [selectedSection]: {
                        ...current[selectedSection],
                        title: event.target.value,
                      },
                    }))
                  }
                  placeholder="Section title"
                />
                <textarea
                  rows={5}
                  style={styles.textarea}
                  value={drafts[selectedSection]?.body || ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [selectedSection]: {
                        ...current[selectedSection],
                        body: event.target.value,
                      },
                    }))
                  }
                  placeholder="Section summary"
                />
                <textarea
                  rows={8}
                  style={styles.textarea}
                  value={drafts[selectedSection]?.points || ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [selectedSection]: {
                        ...current[selectedSection],
                        points: event.target.value,
                      },
                    }))
                  }
                  placeholder="One trust point per line"
                />
              </div>

              <div style={styles.previewPanel}>
                <span style={styles.eyebrowAlt}>Live Preview</span>
                <h3 style={styles.panelTitle}>{previewSection.title}</h3>
                <p style={styles.bodyAlt}>{previewSection.body}</p>
                <div style={styles.grid}>
                  {(previewSection.points || []).map((item) => (
                    <article key={item} style={styles.card}>
                      <p>{item}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <p style={styles.bodyAlt}>{currentSection.body}</p>
              <div style={styles.grid}>
                {(currentSection.points || []).map((item) => (
                  <article key={item} style={styles.card}>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { borderRadius: "28px", border: "1px solid #dbe5f4", background: "linear-gradient(135deg, #17315f 0%, #245293 52%, #f8fbff 52%, #ffffff 100%)", padding: "24px", display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(220px, 0.75fr)", gap: "18px", alignItems: "start" },
  eyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#9cb8eb", fontWeight: 700 },
  eyebrowAlt: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#5b77a3", fontWeight: 700 },
  title: { margin: "12px 0 8px", fontSize: "34px", lineHeight: 1.08, color: "#ffffff" },
  body: { margin: 0, color: "#dce7ff", lineHeight: 1.8 },
  heroList: { display: "grid", gap: "10px" },
  heroLink: { borderRadius: "16px", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.1)", color: "#ffffff", padding: "14px 16px", textAlign: "left", cursor: "pointer", fontWeight: 700 },
  heroLinkActive: { background: "rgba(255,255,255,0.94)", color: "#17315f", borderColor: "#dbe5f4" },
  panel: { borderRadius: "26px", border: "1px solid #dbe5f4", background: "#ffffff", padding: "24px", boxShadow: "0 16px 40px rgba(19,36,67,0.07)" },
  panelTitle: { margin: "12px 0 10px", fontSize: "32px", lineHeight: 1.1, color: "#17315f" },
  bodyAlt: { margin: 0, color: "#5d6a80", lineHeight: 1.8, maxWidth: "840px" },
  editorHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" },
  editorGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.9fr)", gap: "18px", marginTop: "18px" },
  editorPanel: { display: "grid", gap: "14px" },
  previewPanel: { borderRadius: "22px", border: "1px solid #dbe5f4", background: "#fbfdff", padding: "18px" },
  input: { width: "100%", borderRadius: "14px", border: "1px solid #cfdaec", padding: "12px 14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box" },
  textarea: { width: "100%", borderRadius: "16px", border: "1px solid #cfdaec", padding: "14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box", resize: "vertical" },
  primaryButton: { border: "none", borderRadius: "14px", background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", padding: "14px 18px", cursor: "pointer", fontWeight: 700, width: "fit-content" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "22px" },
  card: { borderRadius: "20px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)", padding: "18px", color: "#4e5f79", lineHeight: 1.7 },
  successText: { color: "#0f6a3e", margin: 0, fontWeight: 600 },
  errorText: { color: "#9f3f3f", margin: 0, fontWeight: 600 },
};

export default TrustCenter;
