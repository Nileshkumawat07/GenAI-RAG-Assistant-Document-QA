import React, { useEffect, useMemo, useState } from "react";

import {
  getManageContentEntries,
  getPublishedContentEntries,
  saveManagedContentEntry,
} from "./aboutContentApi";

const PRICING_SECTIONS = [
  { id: "individual", label: "Individual", eyebrow: "Solo and personal work" },
  { id: "business", label: "Business", eyebrow: "Team-ready collaboration" },
  { id: "enterprise", label: "Enterprise", eyebrow: "Managed scale and control" },
  { id: "developer", label: "Developer", eyebrow: "Builders and integrations" },
  { id: "education", label: "Education", eyebrow: "Students and classrooms" },
];

const DEFAULT_SUPPORT_TITLE = "Need Help?";
const DEFAULT_SUPPORT_ITEMS = [
  "support@yourcompany.com",
  "+91 98765 43210",
  "Secure Razorpay checkout",
];
const DEFAULT_TRUST_BADGES = ["Instant activation", "Encrypted checkout"];

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

function arrayToText(items) {
  return (items || []).join("\n");
}

function normalizePriceLabel(value) {
  return typeof value === "string" ? value.replace(/â‚¹/g, "\u20b9") : value;
}

function buildDefaultContent(sectionDefinitions, planCatalog) {
  return Object.fromEntries(
    PRICING_SECTIONS.map((section) => {
      const definition = sectionDefinitions.find((item) => item.id === section.id) || {};
      const plans = (planCatalog || [])
        .filter((plan) => plan.category === section.id)
        .map((plan) => ({
          id: plan.id,
          title: plan.title,
          priceLabel: normalizePriceLabel(plan.priceLabel),
          cadence: plan.cadence,
          badge:
            plan.accent === "popular"
              ? "Most Popular"
              : plan.accent === "premium"
                ? "Premium"
                : "Active Plan",
          tagline: plan.tagline,
          description: plan.description || definition.description || "",
          features: plan.features || [],
          note: plan.note || "",
          trustBadges: plan.trustBadges || DEFAULT_TRUST_BADGES,
          buttonLabel: plan.buttonLabel || "Buy Plan",
          audience: plan.audience || `Built for ${section.label.toLowerCase()} buyers who want a cleaner premium experience.`,
          spotlight: plan.spotlight || "Structured for stronger trust, faster decisions, and a more premium commercial feel.",
          proofPoints: plan.proofPoints || (plan.features || []).slice(0, 3),
        }));

      return [
        section.id,
        {
          eyebrow: "Secure INR Billing",
          heading: definition.heading || `${section.label} Plans`,
          description: definition.description || `Explore premium ${section.label.toLowerCase()} plans designed for this workspace.`,
          supportTitle: DEFAULT_SUPPORT_TITLE,
          supportItems: DEFAULT_SUPPORT_ITEMS,
          assuranceTitle: definition.assuranceTitle || `${section.label} packaging with a more premium commercial edge`,
          assuranceBody:
            definition.assuranceBody
            || "Present this plan with clearer differentiation, stronger trust cues, and a visual system that feels more mature and deliberate.",
          plans,
        },
      ];
    })
  );
}

function normalizePlans(draftPlans, fallbackPlans) {
  return (fallbackPlans || []).map((basePlan) => {
    const matchingDraft = (draftPlans || []).find((item) => item.id === basePlan.id) || {};
    return {
      ...basePlan,
      ...matchingDraft,
      priceLabel: normalizePriceLabel(matchingDraft.priceLabel || basePlan.priceLabel),
      features: Array.isArray(matchingDraft.features) ? matchingDraft.features : basePlan.features || [],
      trustBadges: Array.isArray(matchingDraft.trustBadges) ? matchingDraft.trustBadges : basePlan.trustBadges || DEFAULT_TRUST_BADGES,
      buttonLabel: matchingDraft.buttonLabel || basePlan.buttonLabel || "Buy Plan",
      audience: matchingDraft.audience || basePlan.audience || "",
      spotlight: matchingDraft.spotlight || basePlan.spotlight || "",
      proofPoints: Array.isArray(matchingDraft.proofPoints) ? matchingDraft.proofPoints : basePlan.proofPoints || [],
    };
  });
}

function toDrafts(contentMap) {
  return Object.fromEntries(
    PRICING_SECTIONS.map((section) => {
      const content = contentMap[section.id];
      return [
        section.id,
        {
          eyebrow: content.eyebrow || "",
          heading: content.heading || "",
          description: content.description || "",
          supportTitle: content.supportTitle || DEFAULT_SUPPORT_TITLE,
          supportItems: arrayToText(content.supportItems),
          assuranceTitle: content.assuranceTitle || "",
          assuranceBody: content.assuranceBody || "",
          plans: (content.plans || []).map((plan) => ({
            ...plan,
            features: arrayToText(plan.features),
            trustBadges: arrayToText(plan.trustBadges),
            proofPoints: arrayToText(plan.proofPoints),
            audience: plan.audience || "",
            spotlight: plan.spotlight || "",
          })),
        },
      ];
    })
  );
}

function Pricing({
  activeCategory = "",
  onCategoryChange = null,
  canEdit = false,
  sectionDefinitions = [],
  planCatalog = [],
  paymentStatus = {},
  activePlanPurchaseId = "",
  hasActiveSubscription = false,
  subscriptionPlanName = "",
  onPlanPurchase = null,
}) {
  const embedded = Boolean(activeCategory && onCategoryChange);
  const [localCategory, setLocalCategory] = useState("individual");
  const [contentMap, setContentMap] = useState(() => buildDefaultContent(sectionDefinitions, planCatalog));
  const [drafts, setDrafts] = useState(() => toDrafts(buildDefaultContent(sectionDefinitions, planCatalog)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState({});

  const selectedCategory = embedded ? activeCategory : localCategory;

  const setCategory = (nextCategory) => {
    if (embedded) {
      onCategoryChange(nextCategory);
      return;
    }
    setLocalCategory(nextCategory);
  };

  useEffect(() => {
    const nextDefaults = buildDefaultContent(sectionDefinitions, planCatalog);
    setContentMap((current) => {
      const hasPersistedData = Object.values(current || {}).some((section) => (section?.plans || []).length > 0);
      return hasPersistedData ? current : nextDefaults;
    });
    setDrafts((current) => {
      const hasDraftData = Object.values(current || {}).some((section) => (section?.plans || []).length > 0);
      return hasDraftData ? current : toDrafts(nextDefaults);
    });
  }, [sectionDefinitions, planCatalog]);

  useEffect(() => {
    let active = true;

    async function loadContent() {
      try {
        setLoading(true);
        setErrorMessage("");
        const defaults = buildDefaultContent(sectionDefinitions, planCatalog);
        const response = canEdit
          ? await getManageContentEntries("pricing")
          : await getPublishedContentEntries("pricing");
        const entries = response?.entries || [];
        const nextMap = { ...defaults };

        entries.forEach((entry) => {
          if (!nextMap[entry.sectionKey]) return;
          const payload = parseEntryPayload(entry);
          nextMap[entry.sectionKey] = {
            ...nextMap[entry.sectionKey],
            ...payload,
            heading: payload.heading || entry.title || nextMap[entry.sectionKey].heading,
            supportItems: Array.isArray(payload.supportItems) ? payload.supportItems : nextMap[entry.sectionKey].supportItems,
            plans: normalizePlans(payload.plans, nextMap[entry.sectionKey].plans),
          };
        });

        if (!active) return;
        setContentMap(nextMap);
        setDrafts(toDrafts(nextMap));
      } catch (error) {
        if (!active) return;
        setErrorMessage(error.message || "Failed to load pricing content.");
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
  }, [canEdit, planCatalog, sectionDefinitions]);

  const currentContent = useMemo(
    () => contentMap[selectedCategory] || buildDefaultContent(sectionDefinitions, planCatalog).individual,
    [contentMap, planCatalog, sectionDefinitions, selectedCategory]
  );

  const sectionDraft = drafts[selectedCategory] || drafts.individual;
  const draftPlans = sectionDraft?.plans || [];
  const selectedPlanId = selectedPlanIds[selectedCategory] || draftPlans[0]?.id || "";
  const selectedPlanDraft = draftPlans.find((item) => item.id === selectedPlanId) || draftPlans[0] || null;

  const updateDraftField = (field, value) => {
    setDrafts((current) => ({
      ...current,
      [selectedCategory]: {
        ...current[selectedCategory],
        [field]: value,
      },
    }));
  };

  const updatePlanDraft = (planId, field, value) => {
    setDrafts((current) => ({
      ...current,
      [selectedCategory]: {
        ...current[selectedCategory],
        plans: (current[selectedCategory]?.plans || []).map((plan) =>
          plan.id === planId ? { ...plan, [field]: value } : plan
        ),
      },
    }));
  };

  const handleSave = async () => {
    const payload = {
      eyebrow: sectionDraft.eyebrow,
      heading: sectionDraft.heading,
      description: sectionDraft.description,
      supportTitle: sectionDraft.supportTitle,
      supportItems: linesToArray(sectionDraft.supportItems),
      assuranceTitle: sectionDraft.assuranceTitle,
      assuranceBody: sectionDraft.assuranceBody,
      plans: (sectionDraft.plans || []).map((plan) => ({
        ...plan,
        features: linesToArray(plan.features),
        trustBadges: linesToArray(plan.trustBadges),
        proofPoints: linesToArray(plan.proofPoints),
      })),
    };

    try {
      setSaving(true);
      setErrorMessage("");
      setStatusMessage("");
      await saveManagedContentEntry({
        pageKey: "pricing",
        sectionKey: selectedCategory,
        title: sectionDraft.heading || PRICING_SECTIONS.find((item) => item.id === selectedCategory)?.label || "Pricing",
        bodyJson: JSON.stringify(payload),
        isPublished: true,
      });
      const nextMap = {
        ...contentMap,
        [selectedCategory]: payload,
      };
      setContentMap(nextMap);
      setDrafts(toDrafts(nextMap));
      setStatusMessage("Pricing content updated and published.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to save pricing content.");
    } finally {
      setSaving(false);
    }
  };

  const renderPublicContent = (content = currentContent) => (
    <div style={styles.stack}>
      <section style={styles.planGrid}>
        {(content.plans || []).map((plan) => {
          const planState = paymentStatus[plan.id];
          const isProcessing = activePlanPurchaseId === plan.id;
          const isCurrentPlan = subscriptionPlanName === plan.title && hasActiveSubscription;
          const isPurchaseDisabled = !onPlanPurchase || !!activePlanPurchaseId || hasActiveSubscription;

          return (
            <article
              key={plan.id}
              style={{
                ...styles.planCard,
                ...(plan.badge === "Premium" ? styles.planCardPremium : {}),
                ...(plan.badge === "Most Popular" ? styles.planCardPopular : {}),
              }}
            >
              <div style={styles.planAmbientGlow} />
              <div style={styles.planTop}>
                <div style={styles.planCopy}>
                  <span style={styles.planBadge}>{plan.badge}</span>
                  <h3 style={styles.planTitle}>{plan.title}</h3>
                  <p style={styles.planTagline}>{plan.tagline}</p>
                  {plan.description ? <p style={styles.planDescription}>{plan.description}</p> : null}
                </div>
                <div style={styles.pricePanel}>
                  <strong style={styles.priceValue}>{plan.priceLabel}</strong>
                  <div style={styles.priceMeta}>
                    <span>{plan.title}</span>
                    <span>{plan.cadence}</span>
                  </div>
                </div>
              </div>

              <div style={styles.planStatementBand}>
                <div style={styles.statementBlock}>
                  <span style={styles.statementLabel}>Ideal For</span>
                  <p style={styles.statementText}>{plan.audience}</p>
                </div>
                <div style={styles.statementBlock}>
                  <span style={styles.statementLabel}>Premium Angle</span>
                  <p style={styles.statementText}>{plan.spotlight}</p>
                </div>
              </div>

              <div style={styles.proofRow}>
                {(plan.proofPoints || []).map((item) => (
                  <span key={item} style={styles.proofPill}>{item}</span>
                ))}
              </div>

              <div style={styles.featureList}>
                {(plan.features || []).map((feature) => (
                  <div key={feature} style={styles.featureItem}>
                    <span style={styles.featureDot} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div style={styles.planFooter}>
                <p style={styles.planNote}>{plan.note}</p>
                <div style={styles.trustRow}>
                  {(plan.trustBadges || []).map((item) => (
                    <span key={item} style={styles.trustPill}>{item}</span>
                  ))}
                </div>
              </div>

              {planState?.text ? (
                <p style={planState.type === "success" ? styles.successText : styles.errorText}>
                  {planState.type === "success" ? `Verified: ${planState.text}` : planState.text}
                </p>
              ) : null}
            </article>
          );
        })}
      </section>

      <section style={styles.assurancePanel}>
        <div>
          <span style={styles.assuranceEyebrow}>Premium Packaging</span>
          <h3 style={styles.assuranceTitle}>{content.assuranceTitle}</h3>
          <p style={styles.assuranceBody}>{content.assuranceBody}</p>
        </div>
        <div style={styles.assuranceColumn}>
          <div style={styles.assuranceGrid}>
            {(content.plans || []).map((plan) => (
              <article key={plan.id} style={styles.assuranceMiniCard}>
                <strong>{plan.title}</strong>
              </article>
            ))}
          </div>
          <div style={styles.assuranceActionArea}>
            {(content.plans || []).map((plan) => {
              const isProcessing = activePlanPurchaseId === plan.id;
              const isCurrentPlan = subscriptionPlanName === plan.title && hasActiveSubscription;
              const isPurchaseDisabled = !onPlanPurchase || !!activePlanPurchaseId || hasActiveSubscription;

              return (
                <button
                  key={plan.id}
                  type="button"
                  style={styles.primaryButton}
                  onClick={() => onPlanPurchase?.(plan)}
                  disabled={isPurchaseDisabled}
                >
                  {isCurrentPlan
                    ? "Premium Active"
                    : hasActiveSubscription
                      ? "Subscription Active"
                      : isProcessing
                        ? "Opening Razorpay..."
                        : plan.buttonLabel || "Buy Plan"}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );

  const renderEditor = () => {
    const previewContent = {
      eyebrow: sectionDraft.eyebrow,
      heading: sectionDraft.heading,
      description: sectionDraft.description,
      supportTitle: sectionDraft.supportTitle,
      supportItems: linesToArray(sectionDraft.supportItems),
      assuranceTitle: sectionDraft.assuranceTitle,
      assuranceBody: sectionDraft.assuranceBody,
      plans: (sectionDraft.plans || []).map((plan) => ({
        ...plan,
        features: linesToArray(plan.features),
        trustBadges: linesToArray(plan.trustBadges),
        proofPoints: linesToArray(plan.proofPoints),
      })),
    };

    return (
      <section style={styles.editorPanel}>
        <div style={styles.editorHeader}>
          <div>
            <span style={styles.sectionEyebrow}>Pricing Studio</span>
            <h3 style={styles.sectionTitle}>Shape the premium pricing story for {PRICING_SECTIONS.find((item) => item.id === selectedCategory)?.label || "this"} plans.</h3>
            <p style={styles.sectionBody}>Edit the visible copy, support details, and plan presentation while keeping the current Razorpay purchase flow untouched.</p>
          </div>
          <button type="button" style={styles.primaryButton} onClick={handleSave} disabled={saving}>
            {saving ? "Publishing..." : "Publish Pricing Changes"}
          </button>
        </div>

        <div style={styles.editorGrid}>
          <div style={styles.formStack}>
            <div style={styles.formCard}>
              <div style={styles.formCardHeader}>
                <div>
                  <span style={styles.sectionEyebrow}>Section Polish</span>
                  <h4 style={styles.formCardTitle}>Edit premium framing</h4>
                </div>
              </div>
              <span style={styles.formLabel}>Assurance title</span>
              <input
                style={styles.input}
                value={sectionDraft.assuranceTitle || ""}
                onChange={(event) => updateDraftField("assuranceTitle", event.target.value)}
              />
              <span style={styles.formLabel}>Assurance body</span>
              <textarea
                rows={4}
                style={styles.textarea}
                value={sectionDraft.assuranceBody || ""}
                onChange={(event) => updateDraftField("assuranceBody", event.target.value)}
              />
            </div>

            <div style={styles.formCard}>
              <div style={styles.formCardHeader}>
                <div>
                  <span style={styles.sectionEyebrow}>Plan Cards</span>
                  <h4 style={styles.formCardTitle}>Edit plan presentation</h4>
                </div>
              </div>

              <div style={styles.managementList}>
                {(draftPlans || []).map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanIds((current) => ({ ...current, [selectedCategory]: plan.id }))}
                    style={{
                      ...styles.managementListItem,
                      ...(selectedPlanDraft?.id === plan.id ? styles.managementListItemActive : {}),
                    }}
                  >
                    <strong>{plan.title}</strong>
                    <span>{plan.priceLabel} {plan.cadence}</span>
                  </button>
                ))}
              </div>

              {selectedPlanDraft ? (
                <div style={styles.formStack}>
                  <span style={styles.formLabel}>Badge</span>
                  <input
                    style={styles.input}
                    value={selectedPlanDraft.badge}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "badge", event.target.value)}
                  />
                  <span style={styles.formLabel}>Plan title</span>
                  <input
                    style={styles.input}
                    value={selectedPlanDraft.title}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "title", event.target.value)}
                  />
                  <span style={styles.formLabel}>Price label</span>
                  <input
                    style={styles.input}
                    value={selectedPlanDraft.priceLabel}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "priceLabel", event.target.value)}
                  />
                  <span style={styles.formLabel}>Cadence</span>
                  <input
                    style={styles.input}
                    value={selectedPlanDraft.cadence}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "cadence", event.target.value)}
                  />
                  <span style={styles.formLabel}>Tagline</span>
                  <textarea
                    rows={3}
                    style={styles.textarea}
                    value={selectedPlanDraft.tagline}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "tagline", event.target.value)}
                  />
                  <span style={styles.formLabel}>Supporting description</span>
                  <textarea
                    rows={3}
                    style={styles.textarea}
                    value={selectedPlanDraft.description}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "description", event.target.value)}
                  />
                  <span style={styles.formLabel}>Audience fit</span>
                  <textarea
                    rows={3}
                    style={styles.textarea}
                    value={selectedPlanDraft.audience || ""}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "audience", event.target.value)}
                  />
                  <span style={styles.formLabel}>Premium angle</span>
                  <textarea
                    rows={3}
                    style={styles.textarea}
                    value={selectedPlanDraft.spotlight || ""}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "spotlight", event.target.value)}
                  />
                  <span style={styles.formLabel}>Features</span>
                  <textarea
                    rows={5}
                    style={styles.textarea}
                    value={selectedPlanDraft.features}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "features", event.target.value)}
                  />
                  <span style={styles.formLabel}>Proof points</span>
                  <textarea
                    rows={3}
                    style={styles.textarea}
                    value={selectedPlanDraft.proofPoints || ""}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "proofPoints", event.target.value)}
                  />
                  <span style={styles.formLabel}>Plan note</span>
                  <textarea
                    rows={3}
                    style={styles.textarea}
                    value={selectedPlanDraft.note}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "note", event.target.value)}
                  />
                  <span style={styles.formLabel}>Trust badges</span>
                  <textarea
                    rows={3}
                    style={styles.textarea}
                    value={selectedPlanDraft.trustBadges}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "trustBadges", event.target.value)}
                  />
                  <span style={styles.formLabel}>Button label</span>
                  <input
                    style={styles.input}
                    value={selectedPlanDraft.buttonLabel}
                    onChange={(event) => updatePlanDraft(selectedPlanDraft.id, "buttonLabel", event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div style={styles.previewPanel}>
            <span style={styles.sectionEyebrow}>Live Preview</span>
            {renderPublicContent(previewContent)}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div style={styles.page}>
      {canEdit ? (
        <div style={styles.pillRow}>
          {PRICING_SECTIONS.map((section) => (
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
      ) : null}

      {loading ? (
        <div style={styles.emptyState}>
          <h4>Loading pricing content</h4>
          <p>Fetching premium plan content and the latest published pricing presentation.</p>
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
  stack: { display: "grid", gap: "18px" },
  planGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" },
  planCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "28px",
    border: "1px solid #dbe5f4",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 46%, #eff5ff 100%)",
    padding: "26px",
    boxShadow: "0 28px 62px rgba(18,37,67,0.09)",
    display: "grid",
    gap: "20px",
  },
  planCardPopular: { borderColor: "#8fb0e3", boxShadow: "0 28px 66px rgba(45,99,183,0.18)" },
  planCardPremium: { borderColor: "#f0d48a", background: "linear-gradient(180deg, #fffdf9 0%, #fff9ec 45%, #fff3de 100%)" },
  planAmbientGlow: {
    position: "absolute",
    top: "-70px",
    right: "-40px",
    width: "220px",
    height: "220px",
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(84,137,228,0.2) 0%, rgba(84,137,228,0) 72%)",
    pointerEvents: "none",
  },
  planTop: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" },
  planCopy: { display: "grid", gap: "10px" },
  planBadge: { display: "inline-flex", alignItems: "center", width: "fit-content", padding: "8px 12px", borderRadius: "999px", background: "#eef4ff", color: "#244e91", fontSize: "12px", fontWeight: 700, border: "1px solid #dae5f8" },
  planTitle: { margin: 0, fontSize: "34px", lineHeight: 1.04, color: "#17315f" },
  planTagline: { margin: 0, color: "#5b6c84", lineHeight: 1.7, fontWeight: 600 },
  planDescription: { margin: 0, color: "#6a7990", lineHeight: 1.65 },
  pricePanel: {
    minWidth: "150px",
    padding: "16px 18px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #18407d 0%, #2e63b4 100%)",
    color: "#ffffff",
    boxShadow: "0 20px 40px rgba(24,64,125,0.22)",
  },
  priceValue: { display: "block", fontSize: "22px", lineHeight: 1.1 },
  priceMeta: { marginTop: "10px", display: "grid", gap: "2px", fontSize: "13px", opacity: 0.92 },
  planStatementBand: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  statementBlock: { borderRadius: "20px", border: "1px solid #dde7f5", background: "rgba(255,255,255,0.88)", padding: "16px", display: "grid", gap: "8px" },
  statementLabel: { fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#6b81a5", fontWeight: 700 },
  statementText: { margin: 0, color: "#28456f", lineHeight: 1.7, fontWeight: 600 },
  proofRow: { display: "flex", flexWrap: "wrap", gap: "10px" },
  proofPill: { padding: "10px 14px", borderRadius: "999px", background: "#f3f7ff", border: "1px solid #dce6f5", color: "#284d81", fontSize: "12px", fontWeight: 700 },
  featureList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  featureItem: { display: "flex", alignItems: "center", gap: "12px", borderRadius: "18px", border: "1px solid #dde6f3", background: "#ffffff", padding: "16px", color: "#3f4f67", boxShadow: "0 12px 22px rgba(21,40,74,0.04)" },
  featureDot: { width: "10px", height: "10px", borderRadius: "999px", background: "#4178d5", flexShrink: 0 },
  planFooter: { display: "grid", gap: "12px" },
  planNote: { margin: 0, color: "#627089", lineHeight: 1.7 },
  trustRow: { display: "flex", flexWrap: "wrap", gap: "10px" },
  trustPill: { padding: "8px 12px", borderRadius: "999px", background: "#edf3ff", color: "#224b90", fontSize: "12px", fontWeight: 700, border: "1px solid #d7e4f6" },
  primaryButton: { border: "none", borderRadius: "16px", background: "linear-gradient(135deg, #142f5d 0%, #2c63b6 58%, #4a86df 100%)", color: "#ffffff", padding: "16px 18px", cursor: "pointer", fontWeight: 800, boxShadow: "0 18px 34px rgba(23,49,95,0.18)" },
  assurancePanel: {
    borderRadius: "28px",
    border: "1px solid #dbe5f4",
    background: "linear-gradient(135deg, #17315f 0%, #21477f 42%, #f7fbff 42%, #ffffff 100%)",
    boxShadow: "0 24px 60px rgba(19,36,67,0.09)",
    padding: "26px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "22px",
    alignItems: "start",
  },
  assuranceEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#9cb8eb", fontWeight: 700 },
  assuranceTitle: { margin: "12px 0 10px", fontSize: "30px", lineHeight: 1.15, color: "#ffffff", maxWidth: "560px" },
  assuranceBody: { margin: 0, color: "#dbe7ff", lineHeight: 1.8, maxWidth: "560px" },
  assuranceColumn: { display: "grid", gap: "18px", alignSelf: "stretch" },
  assuranceGrid: { display: "grid", gap: "12px" },
  assuranceMiniCard: { borderRadius: "20px", border: "1px solid #dbe5f4", background: "rgba(255,255,255,0.95)", padding: "18px", display: "grid", gap: "6px", color: "#17315f", boxShadow: "0 14px 30px rgba(16,34,61,0.08)" },
  assuranceActionArea: { minHeight: "96px", display: "grid", alignContent: "end", gap: "12px" },
  editorPanel: { borderRadius: "26px", border: "1px solid #dbe5f4", background: "#ffffff", padding: "22px", boxShadow: "0 16px 44px rgba(19,36,67,0.08)" },
  editorHeader: { display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "18px" },
  editorGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.95fr)", gap: "18px" },
  formStack: { display: "grid", gap: "16px" },
  formCard: { borderRadius: "22px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #fbfdff 0%, #ffffff 100%)", padding: "18px", display: "grid", gap: "12px" },
  formCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  formCardTitle: { margin: "8px 0 0", color: "#17315f", fontSize: "22px" },
  formLabel: { fontSize: "13px", fontWeight: 700, color: "#5b7396" },
  input: { width: "100%", borderRadius: "14px", border: "1px solid #cfdaec", padding: "12px 14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box" },
  textarea: { width: "100%", borderRadius: "16px", border: "1px solid #cfdaec", padding: "14px", background: "#fcfdff", color: "#17315f", boxSizing: "border-box", resize: "vertical" },
  previewPanel: { borderRadius: "22px", border: "1px solid #dbe5f4", background: "linear-gradient(180deg, #f9fbff 0%, #ffffff 100%)", padding: "18px" },
  pillRow: { display: "flex", flexWrap: "wrap", gap: "12px" },
  pill: { padding: "14px 22px", borderRadius: "999px", border: "1px solid #c6d3eb", background: "#f8fbff", color: "#22406f", cursor: "pointer", fontWeight: 700, boxShadow: "0 8px 22px rgba(20,42,80,0.05)" },
  pillActive: { background: "linear-gradient(135deg, #17315f 0%, #2d63b7 100%)", color: "#ffffff", borderColor: "#17315f", boxShadow: "0 14px 28px rgba(23,49,95,0.18)" },
  sectionEyebrow: { display: "inline-block", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#5e78a4", fontWeight: 700 },
  sectionTitle: { margin: "10px 0 8px", fontSize: "28px", color: "#17315f" },
  sectionBody: { margin: 0, color: "#5d6a80", lineHeight: 1.7, maxWidth: "760px" },
  managementList: { display: "grid", gap: "10px" },
  managementListItem: { textAlign: "left", borderRadius: "16px", border: "1px solid #d5dff0", background: "#fbfdff", padding: "14px", cursor: "pointer", display: "grid", gap: "4px", color: "#17315f" },
  managementListItemActive: { borderColor: "#285ca8", background: "linear-gradient(180deg, #eef4ff 0%, #ffffff 100%)", boxShadow: "0 14px 32px rgba(40,92,168,0.14)" },
  emptyState: { borderRadius: "18px", border: "1px dashed #ccd8eb", background: "#f8fbff", padding: "24px", color: "#5d6a80" },
  successText: { color: "#0f6a3e", margin: 0, fontWeight: 600 },
  errorText: { color: "#9f3f3f", margin: 0, fontWeight: 600 },
};

export default Pricing;
