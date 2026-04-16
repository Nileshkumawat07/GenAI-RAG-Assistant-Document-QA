import React, { useEffect, useMemo, useState } from "react";

import {
  getManageContentEntries,
  getPublishedContentEntries,
  saveManagedContentEntry,
} from "./aboutContentApi";

const ABOUT_SECTIONS = [
  { id: "company", label: "Company" },
  { id: "mission", label: "Mission" },
  { id: "leadership", label: "Leadership" },
  { id: "milestones", label: "Milestones" },
  { id: "culture", label: "Culture" },
];

const DEFAULT_CONTENT = {
  company: {
    title: "Who We Are",
    body: [
      "Founded in 2020, our company is a trusted name in delivering secure, scalable technology solutions. Based in Jaipur, with offices across the USA and Europe, we address global challenges in finance, healthcare, and education sectors.",
      "Our team of 100+ engineers and designers is dedicated to user-centered innovation and agile delivery methodologies, helping clients grow sustainably while embracing digital transformation.",
    ],
  },
  mission: {
    missionTitle: "Our Mission",
    missionBody: [
      "To empower organizations by building future-ready digital platforms that drive efficiency, improve experiences, and foster growth.",
    ],
    visionTitle: "Our Vision",
    visionBody: [
      "To become a global leader in trusted digital transformation, known for ethical practices, innovation, and long-term partnership with our clients.",
    ],
  },
  leadership: {
    title: "Leadership Team",
    members: [
      { name: "Nilesh Kumawat", role: "Founder & CEO" },
      { name: "Ayesha Sharma", role: "CTO" },
      { name: "Rahul Verma", role: "Head of Design" },
      { name: "Meera Desai", role: "VP, Marketing" },
      { name: "Vikram Joshi", role: "Chief Product Officer" },
    ],
  },
  milestones: {
    title: "Our Journey & Milestones",
    items: [
      "2020: Company founded in Jaipur, India.",
      "2021: Launched first flagship product with 10,000+ users.",
      "2022: Opened US & European offices; crossed $1M ARR.",
      "2023: Received Top Innovation in SaaS award.",
      "2024: Expanded to 15 countries with over 1 million users.",
      "2025: Reached 200+ enterprise clients globally.",
    ],
  },
  culture: {
    title: "Our Culture",
    body: [
      "We foster a collaborative, inclusive environment where creativity and accountability thrive.",
      "Our teams engage in quarterly off-site workshops, skill-share sessions, and community outreach programs focused on STEM education.",
    ],
    highlights: [
      "Professional development and leadership training",
      "Flexi-time, remote-friendly work policies",
      "Rigorous code reviews and design focus groups",
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

function linesToArray(value) {
  return (value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function membersToText(members) {
  return (members || []).map((item) => `${item.name} | ${item.role}`).join("\n");
}

function textToMembers(value) {
  return linesToArray(value).map((line) => {
    const [name, role] = line.split("|").map((item) => item.trim());
    return { name: name || "Unnamed", role: role || "Role not provided" };
  });
}

function toDrafts(entriesMap) {
  return {
    company: {
      title: entriesMap.company.title,
      body: (entriesMap.company.body || []).join("\n\n"),
    },
    mission: {
      missionTitle: entriesMap.mission.missionTitle,
      missionBody: (entriesMap.mission.missionBody || []).join("\n\n"),
      visionTitle: entriesMap.mission.visionTitle,
      visionBody: (entriesMap.mission.visionBody || []).join("\n\n"),
    },
    leadership: {
      title: entriesMap.leadership.title,
      members: membersToText(entriesMap.leadership.members),
    },
    milestones: {
      title: entriesMap.milestones.title,
      items: (entriesMap.milestones.items || []).join("\n"),
    },
    culture: {
      title: entriesMap.culture.title,
      body: (entriesMap.culture.body || []).join("\n\n"),
      highlights: (entriesMap.culture.highlights || []).join("\n"),
    },
  };
}

function AboutUs({
  activeCategory = "",
  onCategoryChange = null,
  canEdit = false,
}) {
  const embedded = Boolean(activeCategory && onCategoryChange);
  const [localCategory, setLocalCategory] = useState("company");
  const [contentMap, setContentMap] = useState(DEFAULT_CONTENT);
  const [drafts, setDrafts] = useState(() => toDrafts(DEFAULT_CONTENT));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCategory = embedded ? activeCategory : localCategory;

  const setCategory = (nextCategory) => {
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
          ? await getManageContentEntries("about")
          : await getPublishedContentEntries("about");
        const entries = response?.entries || [];
        const nextMap = { ...DEFAULT_CONTENT };

        entries.forEach((entry) => {
          if (!nextMap[entry.sectionKey]) return;
          nextMap[entry.sectionKey] = {
            ...nextMap[entry.sectionKey],
            ...parseEntryPayload(entry),
            title: parseEntryPayload(entry).title || entry.title || nextMap[entry.sectionKey].title,
          };
        });

        if (!active) return;
        setContentMap(nextMap);
        setDrafts(toDrafts(nextMap));
      } catch (error) {
        if (!active) return;
        setErrorMessage(error.message || "Failed to load about content.");
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
    () => contentMap[selectedCategory] || DEFAULT_CONTENT.company,
    [contentMap, selectedCategory]
  );

  const updateDraft = (sectionId, key, value) => {
    setDrafts((current) => ({
      ...current,
      [sectionId]: {
        ...current[sectionId],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    const sectionDraft = drafts[selectedCategory];
    let bodyPayload = {};
    let title = "";

    if (selectedCategory === "company") {
      bodyPayload = {
        title: sectionDraft.title,
        body: linesToArray(sectionDraft.body.replace(/\n\n/g, "\n")),
      };
      title = sectionDraft.title;
    }
    if (selectedCategory === "mission") {
      bodyPayload = {
        missionTitle: sectionDraft.missionTitle,
        missionBody: linesToArray(sectionDraft.missionBody.replace(/\n\n/g, "\n")),
        visionTitle: sectionDraft.visionTitle,
        visionBody: linesToArray(sectionDraft.visionBody.replace(/\n\n/g, "\n")),
      };
      title = sectionDraft.missionTitle || "Mission";
    }
    if (selectedCategory === "leadership") {
      bodyPayload = {
        title: sectionDraft.title,
        members: textToMembers(sectionDraft.members),
      };
      title = sectionDraft.title;
    }
    if (selectedCategory === "milestones") {
      bodyPayload = {
        title: sectionDraft.title,
        items: linesToArray(sectionDraft.items),
      };
      title = sectionDraft.title;
    }
    if (selectedCategory === "culture") {
      bodyPayload = {
        title: sectionDraft.title,
        body: linesToArray(sectionDraft.body.replace(/\n\n/g, "\n")),
        highlights: linesToArray(sectionDraft.highlights),
      };
      title = sectionDraft.title;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setStatusMessage("");
      await saveManagedContentEntry({
        pageKey: "about",
        sectionKey: selectedCategory,
        title: title || ABOUT_SECTIONS.find((item) => item.id === selectedCategory)?.label || "About",
        bodyJson: JSON.stringify(bodyPayload),
        isPublished: true,
      });
      setContentMap((current) => ({
        ...current,
        [selectedCategory]: {
          ...current[selectedCategory],
          ...bodyPayload,
        },
      }));
      setStatusMessage("About content saved.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to save about content.");
    } finally {
      setSaving(false);
    }
  };

  const renderPublicContent = () => {
    if (selectedCategory === "company") {
      return (
        <section style={styles.sectionPanel}>
          <span style={styles.sectionEyebrow}>About Company</span>
          <h3 style={styles.sectionTitle}>{currentContent.title}</h3>
          <div style={styles.copyStack}>
            {(currentContent.body || []).map((item) => <p key={item}>{item}</p>)}
          </div>
        </section>
      );
    }

    if (selectedCategory === "mission") {
      return (
        <div style={styles.storyGrid}>
          <section style={styles.storyCard}>
            <span style={styles.sectionEyebrow}>Mission</span>
            <h3 style={styles.sectionTitle}>{currentContent.missionTitle}</h3>
            <div style={styles.copyStack}>
              {(currentContent.missionBody || []).map((item) => <p key={item}>{item}</p>)}
            </div>
          </section>
          <section style={styles.storyCard}>
            <span style={styles.sectionEyebrow}>Vision</span>
            <h3 style={styles.sectionTitle}>{currentContent.visionTitle}</h3>
            <div style={styles.copyStack}>
              {(currentContent.visionBody || []).map((item) => <p key={item}>{item}</p>)}
            </div>
          </section>
        </div>
      );
    }

    if (selectedCategory === "leadership") {
      return (
        <section style={styles.sectionPanel}>
          <span style={styles.sectionEyebrow}>Leadership</span>
          <h3 style={styles.sectionTitle}>{currentContent.title}</h3>
          <div style={styles.peopleGrid}>
            {(currentContent.members || []).map((person) => (
              <article key={`${person.name}-${person.role}`} style={styles.personCard}>
                <strong>{person.name}</strong>
                <span>{person.role}</span>
              </article>
            ))}
          </div>
        </section>
      );
    }

    if (selectedCategory === "milestones") {
      return (
        <section style={styles.sectionPanel}>
          <span style={styles.sectionEyebrow}>Milestones</span>
          <h3 style={styles.sectionTitle}>{currentContent.title}</h3>
          <div style={styles.timelineList}>
            {(currentContent.items || []).map((item) => (
              <article key={item} style={styles.timelineCard}>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>
      );
    }

    return (
      <section style={styles.sectionPanel}>
        <span style={styles.sectionEyebrow}>Culture</span>
        <h3 style={styles.sectionTitle}>{currentContent.title}</h3>
        <div style={styles.copyStack}>
          {(currentContent.body || []).map((item) => <p key={item}>{item}</p>)}
        </div>
        <div style={styles.highlightGrid}>
          {(currentContent.highlights || []).map((item) => (
            <article key={item} style={styles.highlightCard}>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>
    );
  };

  const renderEditor = () => {
    const sectionDraft = drafts[selectedCategory];

    return (
      <section style={styles.editorShell}>
        <div style={styles.editorHeader}>
          <div>
            <span style={styles.sectionEyebrow}>About Studio</span>
            <h3 style={styles.sectionTitle}>Edit {ABOUT_SECTIONS.find((item) => item.id === selectedCategory)?.label}</h3>
          </div>
          <button type="button" style={styles.primaryButton} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div style={styles.editorGrid}>
          <div style={styles.editorPanel}>
            {selectedCategory === "company" ? (
              <>
                <input style={styles.input} value={sectionDraft.title} onChange={(e) => updateDraft("company", "title", e.target.value)} placeholder="Section title" />
                <textarea style={styles.textarea} rows={8} value={sectionDraft.body} onChange={(e) => updateDraft("company", "body", e.target.value)} placeholder="Paragraphs, separated by blank lines" />
              </>
            ) : null}

            {selectedCategory === "mission" ? (
              <>
                <input style={styles.input} value={sectionDraft.missionTitle} onChange={(e) => updateDraft("mission", "missionTitle", e.target.value)} placeholder="Mission title" />
                <textarea style={styles.textarea} rows={6} value={sectionDraft.missionBody} onChange={(e) => updateDraft("mission", "missionBody", e.target.value)} placeholder="Mission paragraphs" />
                <input style={styles.input} value={sectionDraft.visionTitle} onChange={(e) => updateDraft("mission", "visionTitle", e.target.value)} placeholder="Vision title" />
                <textarea style={styles.textarea} rows={6} value={sectionDraft.visionBody} onChange={(e) => updateDraft("mission", "visionBody", e.target.value)} placeholder="Vision paragraphs" />
              </>
            ) : null}

            {selectedCategory === "leadership" ? (
              <>
                <input style={styles.input} value={sectionDraft.title} onChange={(e) => updateDraft("leadership", "title", e.target.value)} placeholder="Section title" />
                <textarea style={styles.textarea} rows={10} value={sectionDraft.members} onChange={(e) => updateDraft("leadership", "members", e.target.value)} placeholder="One leader per line: Name | Role" />
              </>
            ) : null}

            {selectedCategory === "milestones" ? (
              <>
                <input style={styles.input} value={sectionDraft.title} onChange={(e) => updateDraft("milestones", "title", e.target.value)} placeholder="Section title" />
                <textarea style={styles.textarea} rows={10} value={sectionDraft.items} onChange={(e) => updateDraft("milestones", "items", e.target.value)} placeholder="One milestone per line" />
              </>
            ) : null}

            {selectedCategory === "culture" ? (
              <>
                <input style={styles.input} value={sectionDraft.title} onChange={(e) => updateDraft("culture", "title", e.target.value)} placeholder="Section title" />
                <textarea style={styles.textarea} rows={6} value={sectionDraft.body} onChange={(e) => updateDraft("culture", "body", e.target.value)} placeholder="Culture paragraphs" />
                <textarea style={styles.textarea} rows={8} value={sectionDraft.highlights} onChange={(e) => updateDraft("culture", "highlights", e.target.value)} placeholder="One highlight per line" />
              </>
            ) : null}
          </div>

          <div style={styles.previewPanel}>
            <span style={styles.sectionEyebrow}>Live Preview</span>
            {renderPublicContent()}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <span style={styles.heroEyebrow}>{canEdit ? "Management Content Studio" : "About Us"}</span>
          <h2 style={styles.heroTitle}>
            {canEdit
              ? "Edit the public About experience and publish updates section by section."
              : "Learn how the company operates, grows, and leads with a sharper brand story."}
          </h2>
          <p style={styles.heroText}>
            {canEdit
              ? "Use the same About subcategories below to update live content that reflects directly on the public About page."
              : "Browse the key company sections through a cleaner premium layout designed to feel more deliberate and easier to scan."}
          </p>
        </div>
      </section>

      <div style={styles.pillRow}>
        {ABOUT_SECTIONS.map((section) => (
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

      {loading ? <div style={styles.emptyState}><h4>Loading about content</h4><p>Fetching the latest published sections.</p></div> : null}
      {statusMessage ? <p style={styles.successText}>{statusMessage}</p> : null}
      {errorMessage ? <p style={styles.errorText}>{errorMessage}</p> : null}
      {!loading ? (canEdit ? renderEditor() : renderPublicContent()) : null}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { padding: "24px", borderRadius: "28px", background: "linear-gradient(135deg, #17315f 0%, #234e93 58%, #3f7ad8 100%)", color: "#ffffff", boxShadow: "0 20px 60px rgba(24,51,95,0.22)" },
  heroEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.82 },
  heroTitle: { margin: "14px 0 10px", fontSize: "34px", lineHeight: 1.12 },
  heroText: { margin: 0, lineHeight: 1.7, maxWidth: "760px", opacity: 0.92 },
  pillRow: { display: "flex", flexWrap: "wrap", gap: "12px" },
  pill: { padding: "14px 22px", borderRadius: "999px", border: "1px solid #c6d3eb", background: "#f8fbff", color: "#22406f", cursor: "pointer", fontWeight: 700, boxShadow: "0 8px 22px rgba(20,42,80,0.05)" },
  pillActive: { background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", borderColor: "#17315f", boxShadow: "0 14px 28px rgba(23,49,95,0.18)" },
  sectionPanel: { borderRadius: "24px", background: "#ffffff", border: "1px solid #dbe4f3", padding: "24px", boxShadow: "0 12px 36px rgba(19,36,67,0.06)" },
  storyGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" },
  storyCard: { borderRadius: "22px", border: "1px solid #dbe4f3", background: "#ffffff", padding: "24px", boxShadow: "0 12px 36px rgba(19,36,67,0.06)" },
  sectionEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#5e78a4", fontWeight: 700 },
  sectionTitle: { margin: "10px 0 8px", fontSize: "28px", color: "#17315f" },
  copyStack: { display: "grid", gap: "12px", color: "#5d6a80", lineHeight: 1.7 },
  peopleGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", marginTop: "16px" },
  personCard: { borderRadius: "18px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", padding: "18px", display: "grid", gap: "8px", color: "#5d6a80" },
  timelineList: { display: "grid", gap: "14px", marginTop: "16px" },
  timelineCard: { borderRadius: "18px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", padding: "18px", color: "#5d6a80", lineHeight: 1.7 },
  highlightGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", marginTop: "18px" },
  highlightCard: { borderRadius: "18px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", padding: "18px", color: "#5d6a80", lineHeight: 1.7 },
  editorShell: { borderRadius: "24px", background: "#ffffff", border: "1px solid #dbe4f3", padding: "24px", boxShadow: "0 12px 36px rgba(19,36,67,0.06)" },
  editorHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "18px" },
  editorGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(340px, 0.95fr)", gap: "18px" },
  editorPanel: { borderRadius: "20px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", padding: "18px", display: "grid", gap: "14px" },
  previewPanel: { borderRadius: "20px", border: "1px solid #dbe5f4", background: "#fbfdff", padding: "18px" },
  input: { width: "100%", borderRadius: "14px", border: "1px solid #cfdaec", padding: "12px 14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box" },
  textarea: { width: "100%", borderRadius: "16px", border: "1px solid #cfdaec", padding: "14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box", resize: "vertical" },
  primaryButton: { border: "none", borderRadius: "14px", background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#fff", padding: "12px 18px", cursor: "pointer", fontWeight: 700, boxShadow: "0 14px 28px rgba(23,49,95,0.18)" },
  emptyState: { borderRadius: "18px", border: "1px dashed #ccd8eb", background: "#f8fbff", padding: "24px", color: "#5d6a80" },
  successText: { color: "#0f6a3e", margin: 0, fontWeight: 600 },
  errorText: { color: "#9f3f3f", margin: 0, fontWeight: 600 },
};

export default AboutUs;
