import React, { useEffect, useMemo, useState } from "react";

import {
  getManageContentEntries,
  getPublishedContentEntries,
  saveManagedContentEntry,
} from "./aboutContentApi";

const FAQ_SECTIONS = [
  { id: "general", label: "General", eyebrow: "Core product guidance" },
  { id: "billing", label: "Billing", eyebrow: "Plans and payments" },
  { id: "technical", label: "Technical", eyebrow: "Support and platform help" },
  { id: "security", label: "Security", eyebrow: "Trust and compliance" },
  { id: "accounts", label: "Accounts", eyebrow: "Profile and access" },
];

const DEFAULT_CONTENT = {
  general: {
    title: "General Questions",
    description: "Browse the most common platform questions and the answers users usually need first.",
    questions: [
      {
        question: "What is the purpose of this platform?",
        answer: "To deliver secure and scalable solutions for users across industries with a focus on efficiency and ease of use.",
      },
      {
        question: "Who can use this platform?",
        answer: "Our tools are designed for individuals, startups, and enterprise-level organizations seeking digital transformation.",
      },
      {
        question: "Do you offer a trial version?",
        answer: "Yes, most plans come with a 7-day free trial to help users explore features before committing.",
      },
      {
        question: "How often is the platform updated?",
        answer: "We ship regular improvements, security updates, and quality-of-life fixes to keep the workspace reliable.",
      },
    ],
  },
  billing: {
    title: "Billing & Payments",
    description: "Clear answers for invoices, renewals, refunds, taxes, and subscription management.",
    questions: [
      {
        question: "What payment methods do you accept?",
        answer: "We accept major credit and debit cards, supported wallets, and custom invoicing for eligible business accounts.",
      },
      {
        question: "How do I view my invoice?",
        answer: "Invoices are available from your billing history inside the account workspace.",
      },
      {
        question: "Can I change my billing cycle?",
        answer: "Yes, you can switch between monthly and yearly billing from your subscription settings when the plan supports it.",
      },
      {
        question: "How do refunds work?",
        answer: "Refund requests are reviewed according to plan terms, billing status, and the request timeline.",
      },
    ],
  },
  technical: {
    title: "Technical Support",
    description: "Troubleshooting basics, response expectations, compatibility details, and reporting guidance.",
    questions: [
      {
        question: "How do I contact technical support?",
        answer: "Use the Help Center, contact form, or your assigned support channel if your plan includes managed assistance.",
      },
      {
        question: "Which browsers are supported?",
        answer: "The latest versions of Chrome, Edge, Firefox, and Safari are supported for the best experience.",
      },
      {
        question: "Where can I report a bug?",
        answer: "Bug reports can be submitted through the feedback flow in the workspace or through support.",
      },
      {
        question: "Do you provide documentation?",
        answer: "Yes, product guides and onboarding resources are available for core workflows and support tasks.",
      },
    ],
  },
  security: {
    title: "Security & Compliance",
    description: "Answers about encryption, access controls, backup practices, and compliance expectations.",
    questions: [
      {
        question: "Is my data encrypted?",
        answer: "Yes, platform data is protected in transit and at rest using standard modern encryption practices.",
      },
      {
        question: "Is multi-factor authentication supported?",
        answer: "Yes, additional account verification options are supported for stronger access control.",
      },
      {
        question: "How are backups handled?",
        answer: "Regular backups and retention workflows are used to support resilience and operational recovery.",
      },
      {
        question: "How do I report a security concern?",
        answer: "Use the designated support or security contact route so the issue can be reviewed quickly and safely.",
      },
    ],
  },
  accounts: {
    title: "Account Management",
    description: "Profile updates, password recovery, access recovery, notifications, and account ownership guidance.",
    questions: [
      {
        question: "How do I update my profile?",
        answer: "Go to your account settings and edit the fields you want to update.",
      },
      {
        question: "How do I reset my password?",
        answer: "Use the password recovery flow from the sign-in page and follow the verification steps.",
      },
      {
        question: "Can I delete my account?",
        answer: "Yes, account deletion can be requested from the privacy or account settings flow where available.",
      },
      {
        question: "What happens if I lose access to my email?",
        answer: "Contact support for identity verification and account recovery options.",
      },
    ],
  },
};

function parseEntryPayload(entry) {
  try {
    return JSON.parse(entry?.bodyJson || "{}");
  } catch {
    return {};
  }
}

function normalizeQuestions(items) {
  return (items || [])
    .map((item) => ({
      question: (item?.question || item?.q || "").trim(),
      answer: (item?.answer || item?.a || "").trim(),
    }))
    .filter((item) => item.question && item.answer);
}

function toDrafts(entriesMap) {
  return Object.fromEntries(
    FAQ_SECTIONS.map((section) => [
      section.id,
      {
        title: entriesMap[section.id]?.title || "",
        description: entriesMap[section.id]?.description || "",
        questions: normalizeQuestions(entriesMap[section.id]?.questions),
      },
    ])
  );
}

function FAQs({
  activeCategory = "",
  onCategoryChange = null,
  canEdit = false,
}) {
  const embedded = Boolean(activeCategory && onCategoryChange);
  const [localCategory, setLocalCategory] = useState("general");
  const [contentMap, setContentMap] = useState(DEFAULT_CONTENT);
  const [drafts, setDrafts] = useState(() => toDrafts(DEFAULT_CONTENT));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedItemId, setExpandedItemId] = useState("general-0");

  const selectedCategory = embedded ? activeCategory : localCategory;

  const setCategory = (nextCategory) => {
    setExpandedItemId(`${nextCategory}-0`);
    if (embedded) {
      onCategoryChange(nextCategory);
      return;
    }
    setLocalCategory(nextCategory);
  };

  useEffect(() => {
    let active = true;

    async function loadContent() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = canEdit
          ? await getManageContentEntries("faqs")
          : await getPublishedContentEntries("faqs");
        const entries = response?.entries || [];
        const nextMap = { ...DEFAULT_CONTENT };

        entries.forEach((entry) => {
          if (!nextMap[entry.sectionKey]) return;
          const payload = parseEntryPayload(entry);
          nextMap[entry.sectionKey] = {
            ...nextMap[entry.sectionKey],
            ...payload,
            title: payload.title || entry.title || nextMap[entry.sectionKey].title,
            description: payload.description || nextMap[entry.sectionKey].description,
            questions: normalizeQuestions(payload.questions || nextMap[entry.sectionKey].questions),
          };
        });

        if (!active) return;
        setContentMap(nextMap);
        setDrafts(toDrafts(nextMap));
      } catch (error) {
        if (!active) return;
        setErrorMessage(error.message || "Failed to load FAQ content.");
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

  const currentContent = useMemo(
    () => contentMap[selectedCategory] || DEFAULT_CONTENT.general,
    [contentMap, selectedCategory]
  );

  const sectionDraft = drafts[selectedCategory] || drafts.general;

  const updateDraftField = (field, value) => {
    setDrafts((current) => ({
      ...current,
      [selectedCategory]: {
        ...current[selectedCategory],
        [field]: value,
      },
    }));
  };

  const updateQuestion = (index, field, value) => {
    setDrafts((current) => {
      const nextQuestions = [...(current[selectedCategory]?.questions || [])];
      nextQuestions[index] = {
        ...nextQuestions[index],
        [field]: value,
      };
      return {
        ...current,
        [selectedCategory]: {
          ...current[selectedCategory],
          questions: nextQuestions,
        },
      };
    });
  };

  const addQuestion = () => {
    setDrafts((current) => ({
      ...current,
      [selectedCategory]: {
        ...current[selectedCategory],
        questions: [
          ...(current[selectedCategory]?.questions || []),
          { question: "", answer: "" },
        ],
      },
    }));
  };

  const removeQuestion = (index) => {
    setDrafts((current) => {
      const nextQuestions = (current[selectedCategory]?.questions || []).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        [selectedCategory]: {
          ...current[selectedCategory],
          questions: nextQuestions.length > 0 ? nextQuestions : [{ question: "", answer: "" }],
        },
      };
    });
  };

  const handleSave = async () => {
    const cleanedQuestions = normalizeQuestions(sectionDraft.questions);
    const bodyPayload = {
      title: (sectionDraft.title || "").trim() || FAQ_SECTIONS.find((item) => item.id === selectedCategory)?.label || "FAQs",
      description: (sectionDraft.description || "").trim(),
      questions: cleanedQuestions,
    };

    try {
      setSaving(true);
      setErrorMessage("");
      setStatusMessage("");
      await saveManagedContentEntry({
        pageKey: "faqs",
        sectionKey: selectedCategory,
        title: bodyPayload.title,
        bodyJson: JSON.stringify(bodyPayload),
        isPublished: true,
      });
      setContentMap((current) => ({
        ...current,
        [selectedCategory]: bodyPayload,
      }));
      setDrafts((current) => ({
        ...current,
        [selectedCategory]: {
          title: bodyPayload.title,
          description: bodyPayload.description,
          questions: bodyPayload.questions.length > 0 ? bodyPayload.questions : [{ question: "", answer: "" }],
        },
      }));
      setStatusMessage("FAQ content saved.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to save FAQ content.");
    } finally {
      setSaving(false);
    }
  };

  const renderPublicContent = (content = currentContent) => {
    const questions = normalizeQuestions(content.questions);
    return (
      <section style={styles.surfacePanel}>
        <div style={styles.topicHeader}>
          <div>
            <span style={styles.sectionEyebrow}>
              {FAQ_SECTIONS.find((item) => item.id === selectedCategory)?.eyebrow || "FAQ Topic"}
            </span>
            <h3 style={styles.sectionTitle}>{content.title}</h3>
            <p style={styles.sectionBody}>{content.description}</p>
          </div>
          <div style={styles.topicSummaryCard}>
            <strong>{questions.length}</strong>
            <span>Published answers</span>
          </div>
        </div>

        <div style={styles.faqList}>
          {questions.map((item, index) => {
            const itemId = `${selectedCategory}-${index}`;
            const expanded = expandedItemId === itemId;
            return (
              <article key={itemId} style={styles.faqItem}>
                <button
                  type="button"
                  style={styles.faqQuestionButton}
                  onClick={() => setExpandedItemId(expanded ? "" : itemId)}
                >
                  <span>{item.question}</span>
                  <span style={styles.faqToggle}>{expanded ? "-" : "+"}</span>
                </button>
                {expanded ? <p style={styles.faqAnswer}>{item.answer}</p> : null}
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  const renderEditor = () => (
    <section style={styles.editorShell}>
      <div style={styles.editorHeader}>
        <div>
          <span style={styles.sectionEyebrow}>FAQ Studio</span>
          <h3 style={styles.sectionTitle}>
            Edit {FAQ_SECTIONS.find((item) => item.id === selectedCategory)?.label}
          </h3>
        </div>
        <button type="button" style={styles.primaryButton} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Publish FAQ"}
        </button>
      </div>

      <div style={styles.editorGrid}>
        <div style={styles.editorPanel}>
          <input
            style={styles.input}
            value={sectionDraft.title}
            onChange={(event) => updateDraftField("title", event.target.value)}
            placeholder="Section title"
          />
          <textarea
            style={styles.textarea}
            rows={4}
            value={sectionDraft.description}
            onChange={(event) => updateDraftField("description", event.target.value)}
            placeholder="Short topic introduction"
          />

          <div style={styles.editorMetaRow}>
            <div>
              <span style={styles.editorMetaLabel}>Questions</span>
              <p style={styles.editorMetaText}>Add, edit, or remove FAQ pairs for this topic.</p>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={addQuestion}>
              Add Question
            </button>
          </div>

          <div style={styles.questionEditorList}>
            {(sectionDraft.questions || []).map((item, index) => (
              <article key={`${selectedCategory}-editor-${index}`} style={styles.questionEditorCard}>
                <div style={styles.questionEditorHeader}>
                  <strong>Question {index + 1}</strong>
                  <button type="button" style={styles.removeButton} onClick={() => removeQuestion(index)}>
                    Remove
                  </button>
                </div>
                <input
                  style={styles.input}
                  value={item.question}
                  onChange={(event) => updateQuestion(index, "question", event.target.value)}
                  placeholder="Question"
                />
                <textarea
                  style={styles.textarea}
                  rows={4}
                  value={item.answer}
                  onChange={(event) => updateQuestion(index, "answer", event.target.value)}
                  placeholder="Answer"
                />
              </article>
            ))}
          </div>
        </div>

        <div style={styles.previewPanel}>
          <span style={styles.sectionEyebrow}>Live Preview</span>
          {renderPublicContent({
            title: sectionDraft.title,
            description: sectionDraft.description,
            questions: sectionDraft.questions,
          })}
        </div>
      </div>
    </section>
  );

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroCopy}>
          <span style={styles.heroEyebrow}>{canEdit ? "Management FAQ Studio" : "FAQs"}</span>
          <h2 style={styles.heroTitle}>
            {canEdit
              ? "Manage the public FAQ experience with the same polished workflow used for About content."
              : "Get fast answers through a cleaner, easier-to-scan FAQ experience."}
          </h2>
          <p style={styles.heroText}>
            {canEdit
              ? "Each FAQ topic can be updated and published directly from management. Users will see the latest published content immediately on the FAQ page."
              : "Switch between answer groups to find billing, technical, security, and account guidance without leaving the workspace."}
          </p>
        </div>
        <div style={styles.heroStatCard}>
          <span>Topics</span>
          <strong>{FAQ_SECTIONS.length}</strong>
          <p>Managed sections with live publishing support.</p>
        </div>
      </section>

      <div style={styles.pillRow}>
        {FAQ_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setCategory(section.id)}
            style={{
              ...styles.pill,
              ...(selectedCategory === section.id ? styles.pillActive : {}),
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.emptyState}>
          <h4>Loading FAQ content</h4>
          <p>Fetching the latest published answers and management updates.</p>
        </div>
      ) : null}
      {statusMessage ? <p style={styles.successText}>{statusMessage}</p> : null}
      {errorMessage ? <p style={styles.errorText}>{errorMessage}</p> : null}
      {!loading ? (canEdit ? renderEditor() : renderPublicContent()) : null}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: {
    padding: "24px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, #14345b 0%, #1f5b84 48%, #78a8c8 100%)",
    color: "#ffffff",
    boxShadow: "0 20px 60px rgba(18,52,91,0.2)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(220px, 0.65fr)",
    gap: "18px",
    alignItems: "end",
  },
  heroCopy: { display: "grid", gap: "10px" },
  heroEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.84 },
  heroTitle: { margin: 0, fontSize: "34px", lineHeight: 1.12 },
  heroText: { margin: 0, lineHeight: 1.7, maxWidth: "820px", opacity: 0.92 },
  heroStatCard: {
    borderRadius: "22px",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "18px",
    display: "grid",
    gap: "8px",
    backdropFilter: "blur(8px)",
  },
  pillRow: { display: "flex", flexWrap: "wrap", gap: "12px" },
  pill: {
    padding: "14px 22px",
    borderRadius: "999px",
    border: "1px solid #cadcec",
    background: "#f7fbff",
    color: "#1f476d",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 8px 20px rgba(15,38,66,0.05)",
  },
  pillActive: {
    background: "linear-gradient(135deg, #14345b 0%, #256391 100%)",
    color: "#ffffff",
    borderColor: "#14345b",
    boxShadow: "0 16px 30px rgba(20,52,91,0.18)",
  },
  surfacePanel: {
    borderRadius: "24px",
    background: "#ffffff",
    border: "1px solid #dbe6f0",
    padding: "24px",
    boxShadow: "0 12px 36px rgba(16,35,61,0.06)",
  },
  topicHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 180px",
    gap: "16px",
    alignItems: "start",
    marginBottom: "20px",
  },
  topicSummaryCard: {
    borderRadius: "20px",
    border: "1px solid #d9e6f0",
    background: "linear-gradient(180deg, #fafdff 0%, #eef6fb 100%)",
    padding: "18px",
    display: "grid",
    gap: "6px",
    color: "#52708b",
  },
  sectionEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#5a7990", fontWeight: 700 },
  sectionTitle: { margin: "10px 0 8px", fontSize: "28px", color: "#14345b" },
  sectionBody: { margin: 0, color: "#607186", lineHeight: 1.7, maxWidth: "780px" },
  faqList: { display: "grid", gap: "14px" },
  faqItem: {
    borderRadius: "18px",
    border: "1px solid #dbe5ee",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)",
    overflow: "hidden",
  },
  faqQuestionButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "18px 20px",
    textAlign: "left",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    cursor: "pointer",
    color: "#16395d",
    fontWeight: 700,
    fontSize: "15px",
  },
  faqToggle: {
    minWidth: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "#e9f2f8",
    color: "#1f557f",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    lineHeight: 1,
  },
  faqAnswer: { margin: 0, padding: "0 20px 18px", color: "#5d6d81", lineHeight: 1.7 },
  editorShell: {
    borderRadius: "24px",
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    padding: "24px",
    boxShadow: "0 12px 36px rgba(16,35,61,0.06)",
  },
  editorHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "18px" },
  editorGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(340px, 0.95fr)", gap: "18px" },
  editorPanel: {
    borderRadius: "20px",
    border: "1px solid #dce7f0",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)",
    padding: "18px",
    display: "grid",
    gap: "14px",
  },
  previewPanel: { borderRadius: "20px", border: "1px solid #dce7f0", background: "#fbfdff", padding: "18px" },
  input: {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid #cad8e7",
    padding: "12px 14px",
    background: "#fcfeff",
    color: "#16395d",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    borderRadius: "16px",
    border: "1px solid #cad8e7",
    padding: "14px",
    background: "#fcfeff",
    color: "#16395d",
    boxSizing: "border-box",
    resize: "vertical",
  },
  editorMetaRow: { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" },
  editorMetaLabel: { display: "block", color: "#14345b", fontWeight: 700, marginBottom: "4px" },
  editorMetaText: { margin: 0, color: "#6a7d90", fontSize: "14px" },
  questionEditorList: { display: "grid", gap: "14px" },
  questionEditorCard: {
    borderRadius: "18px",
    border: "1px solid #d8e4ef",
    background: "#ffffff",
    padding: "16px",
    display: "grid",
    gap: "12px",
  },
  questionEditorHeader: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap", color: "#14345b" },
  primaryButton: {
    border: "none",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #14345b 0%, #256391 100%)",
    color: "#fff",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 14px 28px rgba(20,52,91,0.18)",
  },
  secondaryButton: {
    borderRadius: "14px",
    border: "1px solid #c7d8e8",
    background: "#f7fbff",
    color: "#1f476d",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
  removeButton: {
    border: "1px solid #e5c7c7",
    borderRadius: "12px",
    background: "#fff7f7",
    color: "#a24b4b",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
  },
  emptyState: { borderRadius: "18px", border: "1px dashed #ccd8e5", background: "#f8fbff", padding: "24px", color: "#5d6d81" },
  successText: { color: "#0f6a3e", margin: 0, fontWeight: 600 },
  errorText: { color: "#9f3f3f", margin: 0, fontWeight: 600 },
};

export default FAQs;
