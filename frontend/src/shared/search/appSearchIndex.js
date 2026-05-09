const INFO_PAGE_SEARCH_DEFINITIONS = {
  about: {
    label: "About Us",
    group: "Company",
    tabs: [
      { id: "company", label: "Company", keywords: ["story", "overview", "company profile", "mission"] },
      { id: "mission", label: "Mission", keywords: ["vision", "purpose", "values"] },
      { id: "leadership", label: "Leadership", keywords: ["team", "founder", "executives"] },
      { id: "milestones", label: "Milestones", keywords: ["journey", "timeline", "history"] },
      { id: "culture", label: "Culture", keywords: ["work culture", "people", "values"] },
    ],
  },
  careers: {
    label: "Careers",
    group: "Company",
    tabs: [
      { id: "positions", label: "Open Positions", keywords: ["jobs", "roles", "hiring"] },
      { id: "life", label: "Life", keywords: ["culture", "benefits", "team"] },
      { id: "internship", label: "Internship", keywords: ["students", "graduates"] },
      { id: "process", label: "Hiring Process", keywords: ["recruitment", "interview"] },
      { id: "applications", label: "Applications", keywords: ["candidate", "referral"] },
    ],
  },
  contact: {
    label: "Contact Us",
    group: "Company",
    tabs: [
      { id: "general", label: "General Inquiry", keywords: ["contact", "support", "inquiry"] },
      { id: "business", label: "Business", keywords: ["sales", "proposal"] },
      { id: "feedback", label: "Feedback", keywords: ["review", "suggestion"] },
      { id: "technical", label: "Technical Support", keywords: ["bug", "issue", "ticket"] },
      { id: "partnership", label: "Partnership", keywords: ["partner", "collaboration"] },
      { id: "media", label: "Media & Press", keywords: ["press", "media"] },
      { id: "submittedRequests", label: "Submitted Requests", keywords: ["history", "requests"] },
    ],
  },
  faqs: {
    label: "FAQs",
    group: "Company",
    tabs: [
      { id: "general", label: "General FAQs", keywords: ["common questions"] },
      { id: "billing", label: "Billing FAQs", keywords: ["payments", "invoice", "refund"] },
      { id: "technical", label: "Technical FAQs", keywords: ["support", "bugs"] },
      { id: "security", label: "Security FAQs", keywords: ["privacy", "compliance"] },
      { id: "accounts", label: "Account FAQs", keywords: ["profile", "password", "delete account"] },
    ],
  },
  pricing: {
    label: "Pricing",
    group: "Company",
    tabs: [
      { id: "individual", label: "Individual Pricing", keywords: ["solo", "starter"] },
      { id: "business", label: "Business Pricing", keywords: ["teams", "growth"] },
      { id: "enterprise", label: "Enterprise Pricing", keywords: ["scale", "managed"] },
      { id: "developer", label: "Developer Pricing", keywords: ["api", "builders"] },
      { id: "education", label: "Education Pricing", keywords: ["students", "classroom"] },
    ],
  },
  help: {
    label: "Help Center",
    group: "Support",
    tabs: [
      { id: "docs", label: "Help Docs", keywords: ["guides", "documentation"] },
      { id: "bug", label: "Report Bug", keywords: ["technical issue", "problem"] },
      { id: "feature", label: "Request Feature", keywords: ["feature request", "improvement"] },
      { id: "history", label: "Support History", keywords: ["tickets", "past requests"] },
    ],
  },
  trust: {
    label: "Trust Center",
    group: "Support",
    tabs: [
      { id: "privacy", label: "Privacy Policy", keywords: ["data", "privacy"] },
      { id: "terms", label: "Terms", keywords: ["terms of service", "legal"] },
      { id: "refunds", label: "Refund Policy", keywords: ["refund", "billing policy"] },
      { id: "security", label: "Security", keywords: ["trust", "protection"] },
      { id: "status", label: "System Status", keywords: ["uptime", "health", "status"] },
    ],
  },
  profile: {
    label: "Profile",
    group: "Account",
    tabs: [
      { id: "overview", label: "Profile Overview", keywords: ["account summary"] },
      { id: "account", label: "Account Details", keywords: ["details", "identity"] },
      { id: "subscription", label: "Subscription", keywords: ["billing", "plan"] },
      { id: "usage", label: "Usage & Limits", keywords: ["limits", "storage", "seats"] },
      { id: "activity", label: "Recent Activity", keywords: ["history"] },
      { id: "security", label: "Security & Access", keywords: ["access", "sessions"] },
    ],
  },
  settings: {
    label: "Settings",
    group: "Account",
    tabs: [],
  },
  administration: {
    label: "Administration",
    group: "Admin",
    tabs: [
      { id: "overview", label: "Overview", keywords: ["admin summary"] },
      { id: "users", label: "User Administration", keywords: ["accounts", "members"] },
      { id: "roles", label: "Roles & Permissions", keywords: ["permissions", "roles"] },
      { id: "requests", label: "Requests", keywords: ["support queue", "sla"] },
      { id: "assignments", label: "Assignments", keywords: ["routing", "ownership"] },
      { id: "analytics", label: "Analytics", keywords: ["reports", "insights"] },
      { id: "billing", label: "Billing Administration", keywords: ["payments", "refunds"] },
      { id: "communications", label: "Communications", keywords: ["templates", "messages"] },
      { id: "compliance", label: "Compliance", keywords: ["audit", "retention"] },
      { id: "operations", label: "Operations", keywords: ["system", "ops"] },
      { id: "content", label: "Content", keywords: ["knowledge", "cms"] },
      { id: "security", label: "Security", keywords: ["abuse", "events"] },
      { id: "automation", label: "Automation", keywords: ["rules", "workflows"] },
      { id: "notifications", label: "Admin Notifications", keywords: ["alerts"] },
      { id: "reports", label: "Reports", keywords: ["exports"] },
      { id: "management", label: "Management Users", keywords: ["managers"] },
      { id: "database", label: "Database", keywords: ["mysql", "tables", "query"] },
    ],
  },
  management: {
    label: "Management",
    group: "Admin",
    tabs: [
      { id: "overview", label: "Management Overview", keywords: ["summary"] },
      { id: "requests", label: "Contact Requests", keywords: ["queue", "tickets"] },
      { id: "users", label: "Management Users", keywords: ["members", "staff"] },
      { id: "support", label: "Support", keywords: ["support table"] },
      { id: "studio", label: "Careers Studio", keywords: ["careers", "jobs", "studio"] },
      { id: "about-studio", label: "About Studio", keywords: ["about", "company content"] },
      { id: "faq-studio", label: "FAQ Studio", keywords: ["faqs", "questions"] },
      { id: "pricing-studio", label: "Pricing Studio", keywords: ["pricing", "plans"] },
      { id: "help-studio", label: "Help Studio", keywords: ["help center", "support content"] },
      { id: "trust-studio", label: "Trust Studio", keywords: ["trust", "privacy", "security content"] },
    ],
  },
};

const WORKSPACE_SECTIONS = [
  { id: "dashboard", label: "Dashboard", description: "Workspace overview, activity, and onboarding.", keywords: ["home", "overview"] },
  { id: "document-retrieval", label: "Document Retrieval", description: "Upload files and ask grounded questions.", keywords: ["documents", "rag", "answers"] },
  { id: "object-detection", label: "Object Detection", description: "Run object detection workflows.", keywords: ["vision", "detection"] },
  { id: "image-generation", label: "Image Generation", description: "Create and manage generated images.", keywords: ["image", "art", "generation"] },
  { id: "analytics", label: "Analytics", description: "Usage, trends, and workspace health.", keywords: ["charts", "metrics"] },
  { id: "notifications", label: "Notifications", description: "Realtime notifications center.", keywords: ["alerts", "updates"] },
  { id: "chat-history", label: "Chat History", description: "Saved threads and prompt history.", keywords: ["history", "messages"] },
  { id: "team-management", label: "Team Management", description: "Teams, seats, and workspace members.", keywords: ["teams", "members", "seats"] },
  { id: "chat", label: "Chat", description: "Realtime chat management and conversations.", keywords: ["messages", "friends", "groups"] },
];

function prettifyPageLabel(pageKey) {
  return INFO_PAGE_SEARCH_DEFINITIONS[pageKey]?.label
    || String(pageKey || "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
}

function prettifySectionLabel(sectionKey) {
  return String(sectionKey || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractSearchText(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => extractSearchText(item)).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => extractSearchText(item)).filter(Boolean).join(" ");
  }
  return String(value);
}

function summarizeText(value, maxLength = 180) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function createSearchItem({
  id,
  label,
  description,
  group,
  groupKey,
  itemType,
  pageKey = "",
  tabKey = "",
  keywords = [],
  searchText = "",
  priority = 0,
  action,
}) {
  return {
    id,
    label,
    description,
    group,
    groupKey,
    itemType,
    pageKey,
    tabKey,
    keywords,
    searchText,
    priority,
    action,
  };
}

export function buildAppSearchItems({
  navigateTo,
  isAdmin,
  isManagement,
  contentEntriesByPage = {},
}) {
  const openWorkspaceSection = (section) => {
    navigateTo("workspace", null);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("genai-mobile-workspace-section", { detail: { section } }));
    }, 0);
  };

  const openInfoPage = (page, tab = "") => {
    navigateTo("workspace", page);
    if (!tab) {
      return;
    }
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("genai-force-info-tab", { detail: { page, tab } }));
    }, 0);
  };

  const baseItems = [
    ...WORKSPACE_SECTIONS.map((section) => createSearchItem({
      id: `workspace-${section.id}`,
      label: section.label,
      description: section.description,
      group: "Workspace",
      groupKey: "workspace",
      itemType: "tool",
      keywords: section.keywords || [],
      searchText: `${section.label} ${section.description} ${(section.keywords || []).join(" ")}`,
      priority: 95,
      action: () => openWorkspaceSection(section.id),
    })),
    ...Object.entries(INFO_PAGE_SEARCH_DEFINITIONS)
      .filter(([page]) => {
        if (page === "administration") {
          return isAdmin;
        }
        if (page === "management") {
          return isAdmin || isManagement;
        }
        return true;
      })
      .flatMap(([page, definition]) => {
        const groupKey = String(definition.group || "").toLowerCase();
        const pageItem = createSearchItem({
          id: `page-${page}`,
          label: definition.label,
          description: `Open ${definition.label}.`,
          group: definition.group,
          groupKey,
          itemType: "page",
          pageKey: page,
          keywords: [definition.label, definition.group],
          searchText: `${definition.label} ${definition.group}`,
          priority: 88,
          action: () => openInfoPage(page),
        });
        const tabItems = (definition.tabs || []).map((tab) => createSearchItem({
          id: `${page}-${tab.id}`,
          label: `${definition.label}: ${tab.label}`,
          description: `Open the ${tab.label} section in ${definition.label}.`,
          group: definition.group,
          groupKey,
          itemType: "section",
          pageKey: page,
          tabKey: tab.id,
          keywords: tab.keywords || [],
          searchText: `${definition.label} ${tab.label} ${(tab.keywords || []).join(" ")}`,
          priority: 82,
          action: () => openInfoPage(page, tab.id),
        }));
        return [pageItem, ...tabItems];
      }),
  ];

  const contentItems = Object.entries(contentEntriesByPage).flatMap(([pageKey, entries]) =>
    (entries || []).map((entry, index) => {
      let payload = {};
      try {
        payload = JSON.parse(entry?.bodyJson || "{}");
      } catch {
        payload = {};
      }
      const pageLabel = prettifyPageLabel(pageKey);
      const sectionLabel = prettifySectionLabel(entry?.sectionKey || `${index + 1}`);
      const contentText = extractSearchText(payload);
      return createSearchItem({
        id: `content-${pageKey}-${entry?.sectionKey || index}`,
        label: `${pageLabel}: ${entry?.title || sectionLabel}`,
        description: summarizeText(contentText || `${pageLabel} ${sectionLabel}`),
        group: `${pageLabel} Content`,
        groupKey: "content",
        itemType: "content",
        pageKey,
        tabKey: entry?.sectionKey || "",
        keywords: [pageLabel, sectionLabel, entry?.title || ""],
        searchText: `${pageLabel} ${sectionLabel} ${entry?.title || ""} ${contentText}`,
        priority: 72,
        action: () => openInfoPage(pageKey, entry?.sectionKey || ""),
      });
    })
  );

  return [...baseItems, ...contentItems];
}
