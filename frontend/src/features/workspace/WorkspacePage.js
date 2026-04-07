import React, { useEffect, useMemo, useState } from "react";

import DocumentRetrievalPanel from "../document-retrieval/DocumentRetrievalPanel";
import ImageGenerationPanel from "../image-generation/ImageGenerationPanel";
import ObjectDetectionPanel from "../object-detection/ObjectDetectionPanel";
import SettingsPanel from "./SettingsPanel";
import { downloadAdministrationExport, getAdminMysqlOverview, normalizeAuthUser } from "../auth/authApi";
import {
  adminDeleteContactRequest,
  adminUpdateContactRequestStatus,
  createContactRequest,
  deleteContactRequest,
  listAllContactRequests,
  listContactRequests,
} from "../info/contactApi";
import { requestJson } from "../../shared/api/http";
import { getSessionId } from "../../shared/session/session";

const PRICING_PLAN_DETAILS = [
  {
    id: "individual-starter",
    category: "individual",
    title: "Individual Starter",
    priceLabel: "₹699",
    cadence: "/ month",
    tagline: "Best for solo research and personal AI workflows.",
    features: ["1 workspace owner", "Smart document answers", "5 GB secure storage", "Priority email help"],
    note: "Ideal for regular individual usage.",
    accent: "standard",
  },
  {
    id: "business-growth",
    category: "business",
    title: "Business Growth",
    priceLabel: "₹1499",
    cadence: "/ month",
    tagline: "Built for growing teams that need speed and shared context.",
    features: ["5 team seats", "Shared workspace activity", "Usage monitoring", "Business support queue"],
    note: "Great fit for startups and small teams.",
    accent: "popular",
  },
  {
    id: "enterprise-scale",
    category: "enterprise",
    title: "Enterprise Scale",
    priceLabel: "₹2999",
    cadence: "/ month",
    tagline: "Premium control, support, and security for larger rollouts.",
    features: ["15 managed users", "Priority onboarding", "Advanced governance", "Dedicated support window"],
    note: "Highest-value tier for managed deployments.",
    accent: "premium",
  },
  {
    id: "developer-pro",
    category: "developer",
    title: "Developer Pro",
    priceLabel: "₹999",
    cadence: "/ month",
    tagline: "Developer-ready access for APIs, testing, and fast iteration.",
    features: ["API-ready workflows", "Webhook-friendly setup", "Faster turnaround", "Sandbox-to-prod guidance"],
    note: "Strong choice for builders and technical teams.",
    accent: "standard",
  },
  {
    id: "education-lite",
    category: "education",
    title: "Education Lite",
    priceLabel: "₹399",
    cadence: "/ month",
    tagline: "Low-cost access for students, projects, and classroom use.",
    features: ["2 active devices", "Study-friendly workspace", "Fast upload and search", "Student email support"],
    note: "Affordable entry plan for learning.",
    accent: "standard",
  },
];

let razorpayScriptPromise;

function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(true), { once: true });
        existingScript.addEventListener("error", () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

const INFO_PAGE_CONFIG = {
  about: {
    title: "About Us",
    description: "Learn more about who we are and what we do",
    message: "Explore the same company content from your reference file inside the current assistant workspace layout.",
    statusTitle: "About Us Notes",
    statusItems: ["Switch tabs to review company details, mission, leadership, milestones, and more."],
    tabs: [
      {
        id: "company",
        label: "Company",
        heading: "Who We Are",
        body: [
          "Founded in 2020, our company is a trusted name in delivering secure, scalable technology solutions. Based in Jaipur, with offices across the USA and Europe, we address global challenges in finance, healthcare, and education sectors.",
          "Our team of 100+ engineers and designers is dedicated to user-centered innovation and agile delivery methodologies, helping clients grow sustainably while embracing digital transformation.",
        ],
        button: "Download Company Brochure",
      },
      {
        id: "mission",
        label: "Mission",
        heading: "Our Mission",
        body: [
          "To empower organizations by building future-ready digital platforms that drive efficiency, improve experiences, and foster growth.",
          "To become a global leader in trusted digital transformation, known for ethical practices, innovation, and long-term partnership with our clients.",
        ],
      },
      {
        id: "leadership",
        label: "Leadership",
        heading: "Leadership Team",
        cards: [
          { title: "Nilesh Kumawat", text: "Founder & CEO" },
          { title: "Ayesha Sharma", text: "CTO" },
          { title: "Rahul Verma", text: "Head of Design" },
          { title: "Meera Desai", text: "VP, Marketing" },
          { title: "Vikram Joshi", text: "Chief Product Officer" },
        ],
      },
      {
        id: "milestones",
        label: "Milestones",
        heading: "Our Journey & Milestones",
        list: [
          "2020: Company founded in Jaipur, India.",
          "2021: Launched first flagship product with 10,000+ users.",
          "2022: Opened US & European offices; crossed $1M ARR.",
          "2023: Received Top Innovation in SaaS award.",
          "2024: Expanded to 15 countries with over 1 million users.",
          "2025: Reached 200+ enterprise clients globally.",
        ],
      },
      {
        id: "culture",
        label: "Culture",
        heading: "Our Culture",
        body: [
          "We foster a collaborative, inclusive environment where creativity and accountability thrive.",
          "Our teams engage in quarterly off-site workshops, skill-share sessions, and community outreach programs focused on STEM education.",
        ],
        list: [
          "Professional development and leadership training",
          "Flexi-time, remote-friendly work policies",
          "Rigorous code reviews and design focus groups",
        ],
      },
    ],
  },
  careers: {
    title: "Careers",
    description: "Explore career opportunities with us",
    message: "Review the same careers content through the main workspace experience.",
    statusTitle: "Careers Notes",
    statusItems: ["Use the sidebar tabs to move across open positions, culture, internships, process, and referrals."],
    tabs: [
      {
        id: "positions",
        label: "Positions",
        heading: "Open Positions",
        body: ["Join our team of innovative thinkers and passionate builders. We're hiring for the following roles:"],
        list: [
          "Frontend Developer – React.js, Tailwind CSS",
          "Backend Developer – Node.js, MongoDB",
          "UI/UX Designer – Figma, Adobe XD",
          "Product Manager – Agile, SaaS",
          "DevOps Engineer – AWS, CI/CD",
        ],
        button: "View All Roles",
      },
      {
        id: "life",
        label: "Life",
        heading: "Life at Our Company",
        body: ["We believe in empowering our employees with flexibility, purpose, and opportunities to grow. Here's what working here looks like:"],
        list: [
          "Work-from-anywhere policy with flexible hours",
          "Monthly knowledge-sharing workshops",
          "Quarterly team retreats and offsites",
          "Inclusive and diverse team culture",
        ],
        button: "Explore Our Culture",
      },
      {
        id: "internship",
        label: "Internship",
        heading: "Internship Program",
        body: ["We offer 3 to 6-month internship opportunities for final year students and fresh graduates in:"],
        list: ["Web Development", "UI/UX Design", "Product Management", "Data Analytics"],
        button: "Apply for Internship",
      },
      {
        id: "process",
        label: "Process",
        heading: "Hiring Process",
        body: ["We value transparency and fairness. Our process includes:"],
        list: [
          "Online Application & Resume Screening",
          "Phone Interview with HR",
          "Technical/Role Assessment",
          "Final Interview with Team Lead",
          "Offer & Onboarding",
        ],
        button: "View Hiring Guide",
      },
      {
        id: "referral",
        label: "Referral",
        heading: "Referral Program",
        body: ["Know someone great? Refer them and earn up to Rs10,000 if they’re hired."],
        list: [
          "Submit a referral form",
          "Get notified if the referral is shortlisted",
          "Receive bonus on successful hire",
        ],
        button: "Refer a Friend",
      },
    ],
  },
  contact: {
    title: "Contact Us",
    description: "Select a category to get started",
    message: "Open the same contact content in the existing assistant layout, with forms shown in the main panel.",
    statusTitle: "Contact Details",
    statusItems: ["Mumbai, India", "hello@yourcompany.com", "+91 98765 43210"],
    tabs: [
      { id: "general", label: "General Inquiry", heading: "General", form: ["First Name", "Last Name", "Email", "Phone Number", "City", "Preferred Contact Time"], textarea: "Your Message", button: "Send Inquiry" },
      { id: "business", label: "Business", heading: "Business", form: ["Company Name", "Your Role", "Business Email", "Phone Number", "Website"], textarea: "Business Proposal", button: "Submit Request" },
      { id: "feedback", label: "Feedback", heading: "Feedback", form: ["Full Name", "Email", "Rate Our Service", "Service Used", "Date of Experience"], textarea: "Your Feedback", button: "Send Feedback" },
      { id: "technical", label: "Technical Support", heading: "Technical", form: ["Full Name", "Email", "Platform (Web/App)", "Issue Type"], textarea: "Issue Description", button: "Submit Ticket" },
      { id: "partnership", label: "Partnership", heading: "Partnership", form: ["Full Name", "Organization", "Email", "Phone Number", "Website / Portfolio"], textarea: "Partnership Details", button: "Submit Proposal" },
      { id: "media", label: "Media & Press", heading: "Media", form: ["Full Name", "Media Company", "Official Email", "Phone Number", "Publication / Channel"], textarea: "Media Request Details", button: "Send Request" },
      { id: "submittedRequests", label: "Submitted Requests", heading: "Submitted Requests" },
    ],
  },
  faqs: {
    title: "FAQs",
    description: "Find answers to common questions",
    message: "Browse the same FAQ topics inside the standard workspace shell.",
    statusTitle: "FAQ Topics",
    statusItems: ["General", "Billing & Payments", "Technical Support", "Security & Compliance", "Account Management"],
    tabs: [
      {
        id: "general",
        label: "General",
        heading: "General Questions",
        qna: [
          ["What is the purpose of this platform?", "To deliver secure and scalable solutions for users across industries with a focus on efficiency and ease of use."],
          ["Who can use this platform?", "Our tools are designed for individuals, startups, and enterprise-level organizations seeking digital transformation."],
          ["Do you offer a trial version?", "Yes, most plans come with a 7-day free trial to help users explore features before committing."],
        ],
      },
      {
        id: "billing",
        label: "Billing",
        heading: "Billing & Payments",
        qna: [
          ["What payment methods do you accept?", "We accept major credit/debit cards, PayPal, Stripe, and bank transfers for enterprise clients."],
          ["How do I view my invoice?", "Invoices are available in your account dashboard under Billing History."],
          ["Can I get a refund?", "Refunds are handled case-by-case. Contact support within 7 days for eligible cases."],
        ],
      },
      {
        id: "technical",
        label: "Technical",
        heading: "Technical Support",
        qna: [
          ["How do I contact tech support?", "Use the Help Center chat, email us, or call support for urgent matters."],
          ["What is the average response time?", "Under 2 hours for Pro/Enterprise users and within 12 hours for Free users."],
          ["Where can I report a bug?", "Bug reports can be submitted through the feedback form on your dashboard."],
        ],
      },
      {
        id: "security",
        label: "Security",
        heading: "Security & Compliance",
        qna: [
          ["Is my data encrypted?", "Yes, data is encrypted at rest and in transit using AES-256 and TLS 1.2+."],
          ["Are you GDPR compliant?", "Yes, we fully comply with GDPR and allow data deletion on request."],
          ["Is 2FA available?", "Yes, Two-Factor Authentication can be enabled via your account settings."],
        ],
      },
      {
        id: "accounts",
        label: "Accounts",
        heading: "Account Management",
        qna: [
          ["How do I update my profile?", "Go to Account Settings and click on Edit Profile to change your details."],
          ["Can I delete my account?", "Yes, under Privacy Settings, click on Delete Account and confirm via OTP."],
          ["How do I reset my password?", "Click Forgot Password on the login screen and follow the verification steps."],
        ],
      },
    ],
  },
  pricing: {
    title: "Pricing",
    description: "Choose a plan category",
    message: "All pricing plans are billed in INR. Choose a plan, pay securely with Razorpay, and start instantly after checkout.",
    statusTitle: "Need Help?",
    statusItems: ["support@yourcompany.com", "+91 98765 43210", "Secure Razorpay checkout"],
    tabs: [
      {
        id: "individual",
        label: "Individual",
        heading: "Individual Plans",
        description: "Simple monthly pricing for independent work and personal productivity.",
      },
      {
        id: "business",
        label: "Business",
        heading: "Business Plans",
        description: "Collaboration-focused plans for teams scaling their AI workflows.",
      },
      {
        id: "enterprise",
        label: "Enterprise",
        heading: "Enterprise Plans",
        description: "Higher-capacity plans for managed deployments and priority support.",
      },
      {
        id: "developer",
        label: "Developer",
        heading: "Developer Plans",
        description: "Flexible pricing for builders working on integrations and automations.",
      },
      {
        id: "education",
        label: "Education",
        heading: "Education Plans",
        description: "Affordable plans for student learning, assignments, and classroom work.",
      },
    ],
  },
  profile: {
    title: "Profile",
    description: "Review account details, subscriptions, activity, and account overview",
    message: "See your account profile and static subscription details inside the same workspace structure.",
    statusTitle: "Profile Summary",
    statusItems: ["Account overview", "Subscription details", "Recent activity", "Security snapshot"],
    tabs: [
      { id: "overview", label: "Overview", heading: "Profile Overview" },
      { id: "account", label: "Account", heading: "Account Details" },
      { id: "subscription", label: "Subscription", heading: "Subscription & Billing" },
      { id: "usage", label: "Usage", heading: "Workspace Usage" },
      { id: "activity", label: "Activity", heading: "Recent Activity" },
      { id: "security", label: "Security", heading: "Security & Access" },
    ],
  },
  settings: {
    title: "Settings",
    description: "Select a category to update",
    message: "Manage the same settings content inside the current assistant workspace layout.",
    statusTitle: "Settings Categories",
    statusItems: ["Account", "Security", "Preferences", "Privacy", "Platform", "Billing"],
    tabs: [
      { id: "account", label: "Account", heading: "Account" },
      { id: "security", label: "Security", heading: "Security" },
      { id: "preferences", label: "Preferences", heading: "Preferences" },
      { id: "privacy", label: "Privacy", heading: "Privacy" },
      { id: "platform", label: "Platform", heading: "Platform" },
      { id: "activity", label: "Activity", heading: "Activity" },
      { id: "linked", label: "Linked", heading: "Linked" },
      { id: "notifications", label: "Notifications", heading: "Notifications" },
      { id: "billing", label: "Billing", heading: "Billing" },
      { id: "region", label: "Region", heading: "Region" },
      { id: "support", label: "Support", heading: "Support" },
      { id: "terms", label: "Terms", heading: "Terms" },
      { id: "reset", label: "Reset", heading: "Reset" },
    ],
  },
  administration: {
    title: "Administration",
    description: "Monitor requests, statuses, and database tables",
    message: "Review admin-only workspace data, including submitted requests and live MySQL table snapshots.",
    statusTitle: "Admin Controls",
    statusItems: ["Admin session active", "Request moderation enabled", "Database overview ready"],
    tabs: [
      { id: "overview", label: "Overview", heading: "Administration Overview" },
      { id: "requests", label: "Contact Requests", heading: "Contact Request Queue" },
      { id: "support", label: "Support", heading: "Support Request Table" },
      { id: "database", label: "Database", heading: "MySQL Table Overview" },
    ],
  },
};

function WorkspacePage({ currentUser, selectedInfoPage = null, onUserUpdate, onAccountDeleted }) {
  const [activeSection, setActiveSection] = useState("document-retrieval");
  const [sessionId] = useState(() => getSessionId());
  const [selectedFile, setSelectedFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [statusFeed, setStatusFeed] = useState([
    { text: "Document retrieval ready.", type: "info" },
    { text: "Upload a document to begin.", type: "info" },
  ]);
  const [infoTabs, setInfoTabs] = useState({});
  const [contactForms, setContactForms] = useState({});
  const [contactStatus, setContactStatus] = useState({});
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactRequests, setContactRequests] = useState([]);
  const [contactRequestsLoading, setContactRequestsLoading] = useState(false);
  const [activeSubmittedCategory, setActiveSubmittedCategory] = useState("general");
  const [adminTables, setAdminTables] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminStatusOptions, setAdminStatusOptions] = useState([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [adminRenewalReminders, setAdminRenewalReminders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminActionRequestId, setAdminActionRequestId] = useState("");
  const [adminReplyDrafts, setAdminReplyDrafts] = useState({});
  const [adminRequestSearch, setAdminRequestSearch] = useState("");
  const [adminSupportSearch, setAdminSupportSearch] = useState("");
  const [adminDatabaseSearch, setAdminDatabaseSearch] = useState("");
  const [adminAuditSearch, setAdminAuditSearch] = useState("");
  const [adminExportLoading, setAdminExportLoading] = useState("");
  const [activeAdminRequestSection, setActiveAdminRequestSection] = useState("In Progress");
  const [activeAdminDatabaseSection, setActiveAdminDatabaseSection] = useState("accounts");
  const [activeAdminDatabaseRequestFilter, setActiveAdminDatabaseRequestFilter] = useState("All");
  const [activeAdminDatabaseRequestCategory, setActiveAdminDatabaseRequestCategory] = useState("All");
  const [focusedContactRequestId, setFocusedContactRequestId] = useState("");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState({});
  const [activePlanPurchaseId, setActivePlanPurchaseId] = useState("");

  const infoConfig = selectedInfoPage ? INFO_PAGE_CONFIG[selectedInfoPage] : null;
  const activeInfoTab = useMemo(() => {
    if (!infoConfig) return null;
    return infoTabs[selectedInfoPage] || infoConfig.tabs[0].id;
  }, [infoConfig, infoTabs, selectedInfoPage]);
  const activeInfoContent = infoConfig
    ? infoConfig.tabs.find((item) => item.id === activeInfoTab) || infoConfig.tabs[0]
    : null;
  const profileName = currentUser?.fullName || currentUser?.name || "User";
  const profileEmail = currentUser?.email || "";
  const profileUsername = currentUser?.username || profileEmail.split("@")[0] || "user_profile";
  const profileAlternateEmail = currentUser?.alternateEmail || "Not provided";
  const profileMobile = currentUser?.mobile || "Not provided";
  const profileDateOfBirth = currentUser?.dateOfBirth || "Not provided";
  const profileGender = currentUser?.gender || "Not provided";
  const profileSecurityQuestion = currentUser?.securityQuestion || "Not provided";
  const profileSecurityAnswer = currentUser?.securityAnswer || "Not provided";
  const profileReferralCode = currentUser?.referralCode || "Not provided";
  const subscriptionPlanName = currentUser?.subscriptionPlanName || "Free Member";
  const subscriptionStatus = currentUser?.subscriptionStatus || "free";
  const subscriptionAmount = currentUser?.subscriptionAmount;
  const subscriptionCurrency = currentUser?.subscriptionCurrency || "INR";
  const subscriptionBillingCycle = currentUser?.subscriptionBillingCycle || "monthly";
  const subscriptionActivatedAt = currentUser?.subscriptionActivatedAt;
  const subscriptionExpiresAt = currentUser?.subscriptionExpiresAt;
  const profileJoined = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not available";
  const formatMoney = (amountInSmallestUnit, currency = "INR") => {
    if (amountInSmallestUnit == null) {
      return currency === "INR" ? "Free" : "N/A";
    }
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amountInSmallestUnit / 100);
  };
  const subscriptionPriceLabel =
    subscriptionAmount != null ? `${formatMoney(subscriptionAmount, subscriptionCurrency)} / ${subscriptionBillingCycle}` : "Free access";
  const subscriptionStatusLabel = subscriptionStatus === "premium" ? "Premium Active" : subscriptionStatus === "expired" ? "Expired" : "Free Access";
  const subscriptionActivationLabel = subscriptionActivatedAt
    ? new Date(subscriptionActivatedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not activated yet";
  const subscriptionExpiryLabel = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not available";
  const hasActiveSubscription = subscriptionStatus === "premium" && !!subscriptionExpiresAt;
  const activeContactStatus = contactStatus[activeInfoTab] || { type: "", text: "" };
  const activePricingPlans = PRICING_PLAN_DETAILS.filter((plan) => plan.category === activeInfoTab);
  const contactCategoryOrder = ["general", "business", "feedback", "technical", "partnership", "media"];
  const isAdmin = !!currentUser?.isAdmin;
  const formatRequestStatusClass = (status) =>
    (status || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const prettifyKey = (value) =>
    (value || "")
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  const matchesAdminSearch = (source, query) => {
    const normalizedQuery = (query || "").trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    return JSON.stringify(source || {})
      .toLowerCase()
      .includes(normalizedQuery);
  };
  const getReminderToneLabel = (urgency) =>
    urgency === "critical" ? "Needs outreach now" : urgency === "warning" ? "Expiring soon" : "Upcoming renewal";
  const getAdminExportSectionForDatabaseSection = (sectionId) => {
    if (sectionId === "subscriptions") return "subscriptions";
    return "users";
  };
  const getDatabaseSections = () => {
    const sectionConfigs = [
      {
        id: "accounts",
        title: "Accounts",
        copy: "User account records with all stored non-secret fields.",
        tableNames: ["users"],
        columns: ["public_user_code", "full_name", "username", "email", "mobile", "subscription_plan_name", "subscription_status", "subscription_expires_at", "created_at"],
      },
      {
        id: "providers",
        title: "Linked Providers",
        copy: "Connected Facebook, LinkedIn, and other provider records with all stored non-secret details.",
        tableNames: ["user_social_links"],
        columns: null,
      },
      {
        id: "subscriptions",
        title: "Subscriptions",
        copy: "Premium plan status and verified payment transactions.",
        tableNames: ["users", "subscription_transactions"],
        columns: null,
      },
      {
        id: "provider-config",
        title: "Provider Configuration",
        copy: "OAuth and provider setup entries, excluding secrets.",
        tableNames: ["social_oauth_configs"],
        columns: null,
      },
    ];

    const usedTableNames = new Set();
    const sections = sectionConfigs
      .map((section) => {
        const tables = section.tableNames
          .map((tableName) => adminTables.find((table) => table.tableName === tableName))
          .filter(Boolean);

        tables.forEach((table) => usedTableNames.add(table.tableName));

        return tables.length > 0 ? { ...section, tables } : null;
      })
      .filter(Boolean);

    const otherTables = adminTables.filter((table) => !usedTableNames.has(table.tableName));
    if (otherTables.length > 0) {
      sections.push({
        id: "other",
        title: "Other Tables",
        copy: "Additional database tables available in this environment.",
        columns: null,
        tables: otherTables,
      });
    }

    return sections;
  };
  const getVisibleColumnsForTable = (table, preferredColumns = null) => {
    const availableColumns = (table?.columns || []).map((column) => column.name);
    const selectedColumns = preferredColumns
      ? preferredColumns.filter((columnName) => availableColumns.includes(columnName))
        : availableColumns.filter((columnName) => {
          const normalized = columnName.toLowerCase();
          return (
            !normalized.includes("password") &&
            !normalized.includes("token") &&
            !normalized.includes("secret") &&
            !normalized.includes("hash") &&
            !normalized.includes("security_answer") &&
            normalized !== "payload_json"
          );
        });

    return selectedColumns.length > 0 ? selectedColumns : availableColumns.slice(0, 6);
  };
  const renderDatabaseCell = (columnName, value) => {
    if (value == null || value === "") {
      return <span className="admin-table-empty">Not available</span>;
    }

    if (columnName.toLowerCase().includes("photo") && String(value).startsWith("http")) {
      return (
        <div className="provider-photo-cell">
          <img src={String(value)} alt="Provider profile" className="provider-photo-preview" />
          <a href={String(value)} target="_blank" rel="noreferrer">
            Open Photo
          </a>
        </div>
      );
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    return String(value);
  };
  const getAdminRequestSections = () => {
    const statuses = adminStatusOptions.length > 0
      ? adminStatusOptions
      : ["In Progress", "In Review", "Completed"];

    return statuses.map((status) => ({
      id: status,
      title: status,
      items: adminRequests.filter(
        (item) =>
          (item.status || statuses[0]) === status &&
          matchesAdminSearch(
            {
              requestCode: item.requestCode,
              category: item.category,
              title: item.title,
              status: item.status,
              userFullName: item.userFullName,
              userEmail: item.userEmail,
              userMobile: item.userMobile,
              values: item.values,
            },
            adminRequestSearch
          )
      ),
    }));
  };
  const getAdminDatabaseRequestFilters = () => {
    const statuses = adminStatusOptions.length > 0
      ? adminStatusOptions
      : ["In Progress", "In Review", "Completed"];

    return [
      {
        id: "All",
        title: "All",
      },
      ...statuses.map((status) => ({
        id: status,
        title: status,
      })),
    ];
  };
  const getAdminDatabaseRequestCategoryFilters = () => {
    const orderedCategories = ["general", "business", "feedback", "technical", "partnership", "media"];

    return [
      { id: "All", title: "All" },
      ...orderedCategories.map((category) => ({
        id: category,
        title: prettifyKey(category),
      })),
    ];
  };
  const getAdminTableByName = (tableName) =>
    adminTables.find((table) => table.tableName === tableName);
  const getAdminUserDetails = (userId) => {
    if (!userId) return null;

    const usersTable = getAdminTableByName("users");
    const providersTable = getAdminTableByName("user_social_links");
    const requestsTable = getAdminTableByName("contact_requests");

    const userRow = (usersTable?.rows || []).find((row) => row.id === userId);
    if (!userRow) return null;

    const userRequests = (requestsTable?.rows || []).filter((row) => row.user_id === userId);
    const userProviders = (providersTable?.rows || []).filter((row) => row.user_id === userId);
    const requestStatusCounts = ["In Progress", "In Review", "Completed"].map((status) => ({
      status,
      count: userRequests.filter((row) => (row.status || "In Progress") === status).length,
    }));

    const timelineItems = [
      {
        title: "Joined Workspace",
        text: userRow.created_at || "Not available",
      },
      ...(userRow.subscription_plan_name ? [{
        title: "Subscription Active",
        text: `${userRow.subscription_plan_name} | Valid till ${userRow.subscription_expires_at || "Unknown"}`,
      }] : []),
      ...userRequests.slice(0, 6).map((requestRow) => ({
        title: `${prettifyKey(requestRow.category || "request")} request`,
        text: `${requestRow.status || "In Progress"} | ${requestRow.created_at || "Unknown date"}`,
      })),
      ...userProviders.slice(0, 4).map((providerRow) => ({
        title: `Linked ${prettifyKey(providerRow.provider || "provider")}`,
        text: providerRow.email || providerRow.provider_id || "Connected provider",
      })),
    ];

    return {
      userRow,
      userRequests,
      userProviders,
      requestStatusCounts,
      timelineItems,
    };
  };

  const hasQuestion = question.trim().length > 0;

  const pushStatus = (text, type = "info") => {
    setStatusFeed((current) =>
      [{ text, type }, ...current.filter((item) => item.text !== text)].slice(0, 6)
    );
  };

  const loadContactRequests = async () => {
    if (!currentUser?.id) {
      return;
    }

    try {
      setContactRequestsLoading(true);
      const requests = await listContactRequests(currentUser.id);
      setContactRequests(requests);
    } catch (error) {
      setContactStatus((current) => ({
        ...current,
        [activeInfoTab || "general"]: { type: "error", text: error.message },
      }));
    } finally {
      setContactRequestsLoading(false);
    }
  };

  const loadAdministrationData = async () => {
    if (!isAdmin) {
      return;
    }

    try {
      setAdminLoading(true);
      setAdminError("");
      const [mysqlOverview, allRequests] = await Promise.all([
        getAdminMysqlOverview(),
        listAllContactRequests(),
      ]);
      setAdminTables(mysqlOverview.tables || []);
      setAdminStatusOptions(mysqlOverview.statusOptions || []);
      setAdminAuditLogs(mysqlOverview.auditLogs || []);
      setAdminRenewalReminders(mysqlOverview.renewalReminders || []);
      setAdminRequests(allRequests || []);
      setAdminReplyDrafts(
        Object.fromEntries(
          (allRequests || []).map((item) => [item.id, item.adminMessage || ""])
        )
      );
    } catch (loadError) {
      setAdminError(loadError.message || "Failed to load administration data.");
    } finally {
      setAdminLoading(false);
    }
  };

  const openContactRequestFromAdmin = (requestRow) => {
    setInfoTabs((current) => ({
      ...current,
      administration: "requests",
    }));
    setActiveAdminRequestSection(requestRow.status || "In Progress");
    setFocusedContactRequestId(requestRow.id);
  };

  const clearFocusedContactRequest = (requestId) => {
    setFocusedContactRequestId((current) => (current === requestId || !requestId ? "" : current));
  };

  const handleAdminExport = async (section, format = "csv") => {
    try {
      setAdminExportLoading(`${section}-${format}`);
      await downloadAdministrationExport(section, format);
    } catch (error) {
      setAdminError(error.message || "Failed to export administration data.");
    } finally {
      setAdminExportLoading("");
    }
  };

  useEffect(() => {
    if (selectedInfoPage === "contact" && currentUser?.id) {
      loadContactRequests();
    }
  }, [selectedInfoPage, currentUser?.id]);

  useEffect(() => {
    if (selectedInfoPage !== "administration" || activeInfoTab !== "requests" || !focusedContactRequestId) {
      return;
    }

    const targetCard = document.getElementById(`admin-request-${focusedContactRequestId}`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedInfoPage, activeInfoTab, focusedContactRequestId, adminRequests, activeAdminRequestSection]);

  useEffect(() => {
    if (selectedInfoPage === "administration" && isAdmin) {
      loadAdministrationData();
    }
  }, [selectedInfoPage, isAdmin]);

  const getContactFieldKey = (tabId, field) => {
    const keyMap = {
      general: {
        "First Name": "firstName",
        "Last Name": "lastName",
        Email: "email",
        "Phone Number": "phoneNumber",
        City: "city",
        "Preferred Contact Time": "preferredContactTime",
        "Your Message": "message",
      },
      business: {
        "Company Name": "companyName",
        "Your Role": "role",
        "Business Email": "email",
        "Phone Number": "phoneNumber",
        Website: "website",
        "Business Proposal": "message",
      },
      feedback: {
        "Full Name": "fullName",
        Email: "email",
        "Rate Our Service": "rating",
        "Service Used": "serviceUsed",
        "Date of Experience": "experienceDate",
        "Your Feedback": "message",
      },
      technical: {
        "Full Name": "fullName",
        Email: "email",
        "Ticket ID": "ticketId",
        "Platform (Web/App)": "platform",
        "Issue Type": "issueType",
        "Issue Description": "message",
      },
      partnership: {
        "Full Name": "fullName",
        Organization: "organization",
        Email: "email",
        "Phone Number": "phoneNumber",
        "Website / Portfolio": "website",
        "Partnership Details": "message",
      },
      media: {
        "Full Name": "fullName",
        "Media Company": "mediaCompany",
        "Official Email": "email",
        "Phone Number": "phoneNumber",
        "Publication / Channel": "publication",
        "Media Request Details": "message",
      },
    };

    return keyMap[tabId]?.[field] || field.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase());
  };

  const getContactValue = (tabId, field) => {
    const key = getContactFieldKey(tabId, field);
    return contactForms[tabId]?.[key] || "";
  };

  const setContactValue = (tabId, field, value) => {
    const key = getContactFieldKey(tabId, field);
    setContactForms((current) => ({
      ...current,
      [tabId]: {
        ...(current[tabId] || {}),
        [key]: value,
      },
    }));
  };

  const handleContactSubmit = async (tabId, title, fields, textarea) => {
    const payload = {};
    const requiredFieldsByTab = {
      general: ["First Name", "Last Name", "Email"],
      business: ["Company Name", "Your Role", "Business Email"],
      feedback: ["Full Name", "Email", "Rate Our Service"],
      technical: ["Full Name", "Email", "Issue Type"],
      partnership: ["Full Name", "Email"],
      media: ["Full Name", "Official Email"],
    };

    for (const field of fields) {
      const key = getContactFieldKey(tabId, field);
      const value = (contactForms[tabId]?.[key] || "").trim();
      payload[key] = value;

      if (!value && requiredFieldsByTab[tabId]?.includes(field)) {
        setContactStatus((current) => ({
          ...current,
          [tabId]: { type: "error", text: `Please fill ${field}.` },
        }));
        return;
      }
    }

    const messageKey = getContactFieldKey(tabId, textarea);
    const messageValue = (contactForms[tabId]?.[messageKey] || "").trim();
    payload[messageKey] = messageValue;

    if (!messageValue) {
      setContactStatus((current) => ({
        ...current,
        [tabId]: { type: "error", text: `Please fill ${textarea}.` },
      }));
      return;
    }

    try {
      setContactSubmitting(true);
      const createdRequest = await createContactRequest({
        userId: currentUser.id,
        category: tabId,
        title,
        values: payload,
      });
      setContactForms((current) => ({ ...current, [tabId]: {} }));
      setContactRequests((current) => [createdRequest, ...current]);
      setContactStatus((current) => ({
        ...current,
        [tabId]: {
          type: "success",
          text: createdRequest.requestCode
            ? `Saved successfully. Tracking ID: ${createdRequest.requestCode}`
            : "Feedback saved successfully.",
        },
      }));
    } catch (error) {
      setContactStatus((current) => ({
        ...current,
        [tabId]: { type: "error", text: error.message || "Failed to send request." },
      }));
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleContactDelete = async (requestId) => {
    try {
      await deleteContactRequest(requestId, currentUser.id);
      setContactRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (error) {
      setContactStatus((current) => ({
        ...current,
        [activeInfoTab]: { type: "error", text: error.message },
      }));
    }
  };

  const handleAdminStatusChange = async (requestId, status) => {
    try {
      setAdminActionRequestId(requestId);
      setAdminError("");
      const updatedRequest = await adminUpdateContactRequestStatus(requestId, {
        status,
        adminMessage: adminReplyDrafts[requestId] || "",
      });
      setAdminRequests((current) =>
        current.map((item) => (item.id === requestId ? updatedRequest : item))
      );
      setAdminReplyDrafts((current) => ({
        ...current,
        [requestId]: updatedRequest.adminMessage || "",
      }));
      await loadAdministrationData();
      clearFocusedContactRequest(requestId);
    } catch (updateError) {
      setAdminError(updateError.message || "Failed to update admin request.");
    } finally {
      setAdminActionRequestId("");
    }
  };

  const handleAdminDelete = async (requestId) => {
    try {
      setAdminActionRequestId(requestId);
      setAdminError("");
      await adminDeleteContactRequest(requestId);
      setAdminRequests((current) => current.filter((item) => item.id !== requestId));
      await loadAdministrationData();
      clearFocusedContactRequest(requestId);
    } catch (deleteError) {
      setAdminError(deleteError.message || "Failed to delete admin request.");
    } finally {
      setAdminActionRequestId("");
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadStatus("");
    setError("");
    pushStatus(`Uploading ${selectedFile.name}...`);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const data = await requestJson(
        "/documents/upload",
        {
          method: "POST",
          headers: { "X-Session-Id": sessionId },
          body: formData,
        },
        "Document upload failed."
      );

      setUploadStatus(`Document indexed successfully with ${data.chunks} chunks.`);
      pushStatus(`Document indexed successfully with ${data.chunks} chunks.`, "success");
    } catch (err) {
      setError(err.message);
      pushStatus(`Upload failed: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setIsAsking(true);
    setAnswer("");
    setError("");
    pushStatus(`Question submitted: ${question.trim()}`);

    try {
      const data = await requestJson(
        "/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Id": sessionId,
          },
          body: JSON.stringify({ question }),
        },
        "Question answering failed."
      );

      setAnswer(data.answer);
      pushStatus("Answer generated successfully.", "success");
    } catch (err) {
      setAnswer(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  const workspaceMessage =
    activeSection === "document-retrieval"
      ? "Transform your documents into an instant answer workspace with fast retrieval and precise responses."
      : activeSection === "object-detection"
        ? "Use Groq vision to inspect an uploaded image and return detected objects with counts and approximate locations."
        : "Generate images from prompts with an SDXL Lightning pipeline that can use cached model files or download them on first use.";

  const statusContent =
    activeSection === "document-retrieval" ? (
      statusFeed.map((item) => (
        <p key={`${item.type}-${item.text}`} className={`status-item status-${item.type}`}>
          {item.text}
        </p>
      ))
    ) : activeSection === "object-detection" ? (
      <>
        <p className="status-item status-info">Object detection is ready.</p>
        <p className="status-item status-info">Upload an image to analyze visible objects.</p>
      </>
    ) : (
      <>
        <p className="status-item status-info">Image generation is ready.</p>
        <p className="status-item status-info">Write a prompt and generate with SDXL Lightning. The first run may take longer while models load.</p>
      </>
    );

  const setPlanStatus = (planId, nextStatus) => {
    setPaymentStatus((current) => ({
      ...current,
      [planId]: nextStatus,
    }));
  };

  const handlePlanPurchase = async (plan) => {
    setActivePlanPurchaseId(plan.id);
    setPlanStatus(plan.id, { type: "", text: "" });

    try {
      const checkoutReady = await loadRazorpayCheckout();
      if (!checkoutReady || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout right now.");
      }

      const order = await requestJson(
        "/payments/razorpay/order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planId: plan.id }),
        },
        "Unable to create the payment order."
      );

      let checkoutResolved = false;
      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.companyName,
        description: order.description,
        order_id: order.orderId,
        prefill: {
          name: profileName,
          email: profileEmail,
          contact: currentUser?.mobile || "",
        },
        notes: {
          planId: plan.id,
          planName: plan.title,
        },
        theme: {
          color: "#123d7a",
        },
        modal: {
          ondismiss: () => {
            if (checkoutResolved) {
              return;
            }
            setActivePlanPurchaseId("");
            setPlanStatus(plan.id, { type: "error", text: "Checkout closed before payment completion." });
          },
        },
        handler: async (response) => {
          checkoutResolved = true;
          try {
            const verification = await requestJson(
              "/payments/razorpay/verify",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  planId: plan.id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              },
              "Unable to verify the payment."
            );

            setPlanStatus(plan.id, {
              type: "success",
              text: `${verification.message} ${plan.title} is ready for activation.`,
            });
            if (verification.user) {
              onUserUpdate(normalizeAuthUser(verification.user));
            }
          } catch (paymentError) {
            setPlanStatus(plan.id, {
              type: "error",
              text: paymentError.message || "Payment completed, but verification failed.",
            });
          } finally {
            setActivePlanPurchaseId("");
          }
        },
      });

      razorpay.on("payment.failed", (response) => {
        checkoutResolved = true;
        setActivePlanPurchaseId("");
        setPlanStatus(plan.id, {
          type: "error",
          text: response?.error?.description || "Payment failed. Please try again.",
        });
      });

      razorpay.open();
    } catch (purchaseError) {
      setPlanStatus(plan.id, {
        type: "error",
        text: purchaseError.message || "Unable to start payment.",
      });
      setActivePlanPurchaseId("");
    }
  };

  const renderInfoContent = () => {
    if (!activeInfoContent) return null;

    if (selectedInfoPage === "administration") {
      const totalRows = adminTables.reduce((sum, table) => sum + (table.rowCount || 0), 0);
      const userTable = adminTables.find((table) => table.tableName === "users");
      const requestTable = adminTables.find((table) => table.tableName === "contact_requests");
      const statusChoices = adminStatusOptions.length > 0
        ? adminStatusOptions
        : ["In Progress", "In Review", "Completed"];
      const filteredAuditLogs = adminAuditLogs.filter((item) =>
        matchesAdminSearch(
          {
            adminName: item.adminName,
            adminEmail: item.adminEmail,
            actionType: item.actionType,
            targetType: item.targetType,
            targetLabel: item.targetLabel,
            detail: item.detail,
          },
          adminAuditSearch
        )
      );

      if (!isAdmin) {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-mini-card">
                <h4>Admin access required</h4>
                <p>This page is only available for accounts with administration privileges.</p>
              </div>
            </article>
          </div>
        );
      }

      if (activeInfoTab === "overview") {
        const overviewCards = [
          { title: "Visible Tables", text: String(adminTables.length) },
          { title: "Rows Indexed", text: String(totalRows) },
          { title: "Users", text: String(userTable?.rowCount || 0) },
          { title: "Contact Requests", text: String(adminRequests.length || requestTable?.rowCount || 0) },
          { title: "Renewal Reminders", text: String(adminRenewalReminders.length) },
          { title: "Audit Entries", text: String(adminAuditLogs.length) },
        ];

        return (
          <>
            <div className="insight-section">
              <div className="insight-card">
                <h3 className="tool-title">{activeInfoContent.heading}</h3>
                <p className="tool-copy">{infoConfig.message}</p>
              </div>
            </div>
            <div className="content-grid single-column">
              <article className="tool-card workspace-copy-card">
                <div className="admin-toolbar">
                  <div className="admin-toolbar-copy">
                    <h4>Administration Snapshot</h4>
                    <p>Live admin data, renewal watchlist, and the latest audit activity.</p>
                  </div>
                  <div className="admin-toolbar-actions">
                    <button
                      className="admin-table-action-button"
                      type="button"
                      onClick={() => handleAdminExport("renewals")}
                      disabled={adminExportLoading === "renewals-csv"}
                    >
                      {adminExportLoading === "renewals-csv" ? "Exporting..." : "Export Renewals"}
                    </button>
                    <button
                      className="admin-table-action-button"
                      type="button"
                      onClick={() => handleAdminExport("audit")}
                      disabled={adminExportLoading === "audit-csv"}
                    >
                      {adminExportLoading === "audit-csv" ? "Exporting..." : "Export Audit"}
                    </button>
                  </div>
                </div>
                {adminLoading ? (
                  <div className="admin-empty-state admin-loading-state">
                    <h4>Loading administration data</h4>
                    <p>Fetching requests, renewal reminders, audit logs, and database snapshots.</p>
                  </div>
                ) : null}
                {adminError ? <p className="error-text">{adminError}</p> : null}
                <div className="workspace-info-grid">
                  {overviewCards.map((card) => (
                    <div key={card.title} className="workspace-mini-card">
                      <h4>{card.title}</h4>
                      <p>{card.text}</p>
                    </div>
                  ))}
                </div>
                <div className="admin-overview-grid">
                  <section className="workspace-mini-card admin-overview-panel">
                    <div className="admin-section-header">
                      <div>
                        <h4>Subscription Renewal Reminders</h4>
                        <p>Members whose premium access expires within the next 14 days.</p>
                      </div>
                    </div>
                    {adminLoading ? null : adminRenewalReminders.length === 0 ? (
                      <div className="admin-empty-state">
                        <h4>No renewal reminders</h4>
                        <p>No active premium memberships are close to expiry right now.</p>
                      </div>
                    ) : (
                      <div className="admin-reminder-list">
                        {adminRenewalReminders.slice(0, 8).map((item) => (
                          <article key={`${item.userId}-${item.expiresAt}`} className={`admin-reminder-card urgency-${item.urgency}`}>
                            <div className="admin-reminder-copy">
                              <strong>{item.fullName || item.email}</strong>
                              <span>{item.email || "No email"} | {item.publicUserCode || "No member ID"}</span>
                              <span>{item.subscriptionPlanName || "Premium"} | {item.reminderLabel}</span>
                            </div>
                            <div className="admin-reminder-meta">
                              <strong>{getReminderToneLabel(item.urgency)}</strong>
                              <span>{new Date(item.expiresAt).toLocaleString("en-GB")}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="workspace-mini-card admin-overview-panel">
                    <div className="admin-section-header">
                      <div>
                        <h4>Recent Audit Trail</h4>
                        <p>Real backend log entries recorded for admin actions.</p>
                      </div>
                      <input
                        className="auth-input workspace-static-input admin-search-input"
                        type="search"
                        placeholder="Search audit logs"
                        value={adminAuditSearch}
                        onChange={(event) => setAdminAuditSearch(event.target.value)}
                      />
                    </div>
                    {adminLoading ? null : filteredAuditLogs.length === 0 ? (
                      <div className="admin-empty-state">
                        <h4>No audit entries found</h4>
                        <p>Admin actions will appear here after moderation or export events are recorded.</p>
                      </div>
                    ) : (
                      <div className="admin-audit-list">
                        {filteredAuditLogs.slice(0, 8).map((item) => (
                          <article key={item.id} className="admin-audit-card">
                            <div className="admin-audit-card-head">
                              <strong>{prettifyKey(item.actionType)}</strong>
                              <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Unknown time"}</span>
                            </div>
                            <p>{item.detail || "No additional details provided."}</p>
                            <div className="admin-audit-meta">
                              <span>{item.adminName || item.adminEmail || "Unknown admin"}</span>
                              <span>{prettifyKey(item.targetType)}: {item.targetLabel || item.targetId || "Not available"}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </article>
            </div>
          </>
        );
      }

      if (activeInfoTab === "requests") {
        const requestSections = getAdminRequestSections();
        const selectedRequestSection =
          requestSections.find((section) => section.id === activeAdminRequestSection) ||
          requestSections[0];

        return (
          <>
            <div className="insight-section">
              <div className="insight-card">
                <h3 className="tool-title">{activeInfoContent.heading}</h3>
                <p className="tool-copy">Update request status, review request details, or remove invalid submissions.</p>
              </div>
            </div>
            <div className="content-grid single-column">
              <article className="tool-card workspace-copy-card">
                <div className="admin-toolbar">
                  <div className="admin-toolbar-copy">
                    <h4>Contact Request Queue</h4>
                    <p>Search, moderate, and export request data without leaving the admin flow.</p>
                  </div>
                  <div className="admin-toolbar-actions">
                    <input
                      className="auth-input workspace-static-input admin-search-input"
                      type="search"
                      placeholder="Search requests, users, email, title"
                      value={adminRequestSearch}
                      onChange={(event) => setAdminRequestSearch(event.target.value)}
                    />
                    <button
                      className="admin-table-action-button"
                      type="button"
                      onClick={() => handleAdminExport("requests")}
                      disabled={adminExportLoading === "requests-csv"}
                    >
                      {adminExportLoading === "requests-csv" ? "Exporting..." : "Export Requests"}
                    </button>
                  </div>
                </div>
                {adminLoading ? (
                  <div className="admin-empty-state admin-loading-state">
                    <h4>Loading request queue</h4>
                    <p>Collecting every submitted contact request for moderation.</p>
                  </div>
                ) : null}
                {adminError ? <p className="error-text">{adminError}</p> : null}
                {!adminLoading && adminRequests.length === 0 ? (
                  <div className="workspace-mini-card">
                    <h4>No contact requests found</h4>
                    <p>New requests will appear here once users submit them from the contact pages.</p>
                  </div>
                ) : (
                  <div className="admin-request-section-stack">
                    <div className="contact-request-category-row">
                      {requestSections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          className={`contact-request-category-button ${selectedRequestSection?.id === section.id ? "active" : ""}`}
                          onClick={() => setActiveAdminRequestSection(section.id)}
                        >
                          <span>{section.title}</span>
                          <strong>{section.items.length}</strong>
                        </button>
                      ))}
                    </div>

                    {selectedRequestSection ? (
                      <section className="admin-request-section">
                        <div className="admin-request-section-header">
                          <div>
                            <h4>{selectedRequestSection.title}</h4>
                            <p>{selectedRequestSection.items.length} request{selectedRequestSection.items.length === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                        {selectedRequestSection.items.length === 0 ? (
                          <div className="admin-empty-state">
                            <h4>No matching requests</h4>
                            <p>Try a different status tab or clear the current search text.</p>
                          </div>
                        ) : (
                          <div className="admin-request-grid">
                            {selectedRequestSection.items.map((requestItem) => (
                              <article
                                key={requestItem.id}
                                id={`admin-request-${requestItem.id}`}
                                className={`admin-request-card ${focusedContactRequestId === requestItem.id ? "is-focused" : ""}`}
                              >
                                <div className="admin-request-card-header">
                                  <div>
                                    <p className="contact-request-type">{requestItem.category || "General Request"}</p>
                                    <h4>{requestItem.requestCode || requestItem.title || "Contact Request"}</h4>
                                  </div>
                                  <span className={`contact-request-status-chip status-${formatRequestStatusClass(requestItem.status)}`}>
                                    {requestItem.status || statusChoices[0]}
                                  </span>
                                </div>

                                <div className="admin-request-user-banner">
                                  <div className="admin-request-user-avatar">
                                    {(requestItem.userFullName || requestItem.userEmail || "U").trim().charAt(0).toUpperCase()}
                                  </div>
                                  <div className="admin-request-user-copy">
                                    <strong>{requestItem.userFullName || "User"}</strong>
                                    <span>{requestItem.userEmail || "No email"}</span>
                                    <span>{requestItem.userMobile || "No mobile"}</span>
                                  </div>
                                </div>

                                <div className="admin-request-meta-grid">
                                  <div className="contact-request-meta-item">
                                    <span>Created</span>
                                    <strong>{new Date(requestItem.createdAt).toLocaleString("en-GB")}</strong>
                                  </div>
                                  <div className="contact-request-meta-item">
                                    <span>Title</span>
                                    <strong>{requestItem.title || "Not provided"}</strong>
                                  </div>
                                </div>

                                <div className="admin-request-detail-grid">
                                  {Object.entries(requestItem.values || {}).map(([key, value]) => (
                                    <div key={key} className="contact-request-detail-item">
                                      <span>{prettifyKey(key)}</span>
                                      <strong>{value || "Not provided"}</strong>
                                    </div>
                                  ))}
                                </div>

                                <div className="workspace-form-stack admin-request-actions">
                                  <textarea
                                    className="question-input workspace-static-textarea"
                                    rows={4}
                                    placeholder="Write the message that the user should see with this status update."
                                    value={adminReplyDrafts[requestItem.id] || ""}
                                    onChange={(event) =>
                                      setAdminReplyDrafts((current) => ({
                                        ...current,
                                        [requestItem.id]: event.target.value,
                                      }))
                                    }
                                    disabled={adminActionRequestId === requestItem.id}
                                  />
                                  <div className="admin-request-action-row">
                                    <select
                                      className="auth-input workspace-static-input"
                                      value={requestItem.status || statusChoices[0]}
                                      onChange={(event) => handleAdminStatusChange(requestItem.id, event.target.value)}
                                      disabled={adminActionRequestId === requestItem.id}
                                    >
                                      {statusChoices.map((statusOption) => (
                                        <option key={statusOption} value={statusOption}>
                                          {statusOption}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      className="primary-button"
                                      type="button"
                                      onClick={() => handleAdminDelete(requestItem.id)}
                                      disabled={adminActionRequestId === requestItem.id}
                                    >
                                      {adminActionRequestId === requestItem.id ? "Working..." : "Delete Request"}
                                    </button>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    ) : null}
                  </div>
                )}
              </article>
            </div>
          </>
        );
      }

      if (activeInfoTab === "support") {
        const requestTable = getAdminTableByName("contact_requests");
        const requestRows = requestTable?.rows || [];
        const requestFilters = getAdminDatabaseRequestFilters();
        const categoryFilters = getAdminDatabaseRequestCategoryFilters();
        const visibleColumns = requestTable ? getVisibleColumnsForTable(requestTable, null) : [];
        const tableColumns = requestTable ? [...visibleColumns, "__open_request__"] : [];
        const filteredRows = requestRows.filter(
          (row) =>
            (activeAdminDatabaseRequestFilter === "All" ||
              (row.status || "In Progress") === activeAdminDatabaseRequestFilter) &&
            (activeAdminDatabaseRequestCategory === "All" ||
              (row.category || "").toLowerCase() === activeAdminDatabaseRequestCategory) &&
            matchesAdminSearch(row, adminSupportSearch)
        );

        return (
          <>
            <div className="insight-section">
              <div className="insight-card">
                <h3 className="tool-title">{activeInfoContent.heading}</h3>
                <p className="tool-copy">Browse support requests with status and category filters in one dedicated admin section.</p>
              </div>
            </div>
            <div className="content-grid single-column">
              <article className="tool-card workspace-copy-card">
                <div className="admin-toolbar">
                  <div className="admin-toolbar-copy">
                    <h4>Support Request Table</h4>
                    <p>Use filters for status and category, then search the table or export it.</p>
                  </div>
                  <div className="admin-toolbar-actions">
                    <input
                      className="auth-input workspace-static-input admin-search-input"
                      type="search"
                      placeholder="Search support table"
                      value={adminSupportSearch}
                      onChange={(event) => setAdminSupportSearch(event.target.value)}
                    />
                    <button
                      className="admin-table-action-button"
                      type="button"
                      onClick={() => handleAdminExport("requests", "json")}
                      disabled={adminExportLoading === "requests-json"}
                    >
                      {adminExportLoading === "requests-json" ? "Exporting..." : "Export JSON"}
                    </button>
                  </div>
                </div>
                <div className="workspace-form-stack">
                  <div className="contact-request-category-row">
                    {requestFilters.map((filter) => {
                      const count =
                        filter.id === "All"
                          ? requestRows.length
                          : requestRows.filter(
                              (row) => (row.status || "In Progress") === filter.id
                            ).length;

                      return (
                        <button
                          key={filter.id}
                          type="button"
                          className={`contact-request-category-button ${activeAdminDatabaseRequestFilter === filter.id ? "active" : ""}`}
                          onClick={() => setActiveAdminDatabaseRequestFilter(filter.id)}
                        >
                          <span>{filter.title}</span>
                          <strong>{count}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <div className="contact-request-category-row">
                    {categoryFilters.map((filter) => {
                      const rowsForStatus = requestRows.filter(
                        (row) =>
                          activeAdminDatabaseRequestFilter === "All" ||
                          (row.status || "In Progress") === activeAdminDatabaseRequestFilter
                      );
                      const count =
                        filter.id === "All"
                          ? rowsForStatus.length
                          : rowsForStatus.filter(
                              (row) => (row.category || "").toLowerCase() === filter.id
                            ).length;

                      return (
                        <button
                          key={filter.id}
                          type="button"
                          className={`contact-request-category-button ${activeAdminDatabaseRequestCategory === filter.id ? "active" : ""}`}
                          onClick={() => setActiveAdminDatabaseRequestCategory(filter.id)}
                        >
                          <span>{filter.title}</span>
                          <strong>{count}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <section className="admin-table-section">
                    <div className="admin-table-header">
                      <div>
                        <h4>Contact Requests</h4>
                      </div>
                    </div>
                    <div className="admin-table-scroll">
                      <table className="admin-data-table">
                        <thead>
                          <tr>
                            {tableColumns.map((columnName) => (
                              <th key={columnName}>
                                <span>{columnName === "__open_request__" ? "Open Request" : prettifyKey(columnName)}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.length > 0 ? (
                            filteredRows.slice(0, 10).map((row, index) => (
                              <tr key={`support-${index}`}>
                                {tableColumns.map((columnName) => (
                                  <td key={`support-${index}-${columnName}`}>
                                    {columnName === "__open_request__" ? (
                                      <button
                                        type="button"
                                        className="admin-table-action-button"
                                        onClick={() => openContactRequestFromAdmin(row)}
                                      >
                                        Open Request
                                      </button>
                                    ) : (
                                      renderDatabaseCell(columnName, row[columnName])
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={tableColumns.length || 1} className="admin-table-empty-row">
                                No support requests matched the current filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </article>
            </div>
          </>
        );
      }

      return (
        <>
          <div className="insight-section">
            <div className="insight-card">
              <h3 className="tool-title">{activeInfoContent.heading}</h3>
              <p className="tool-copy">Live table snapshots are pulled from the backend admin overview route.</p>
            </div>
          </div>
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="admin-toolbar">
                <div className="admin-toolbar-copy">
                  <h4>Database Overview</h4>
                  <p>Review live table snapshots, search within the current section, and export account or subscription data.</p>
                </div>
                <div className="admin-toolbar-actions">
                  <input
                    className="auth-input workspace-static-input admin-search-input"
                    type="search"
                    placeholder="Search database rows"
                    value={adminDatabaseSearch}
                    onChange={(event) => setAdminDatabaseSearch(event.target.value)}
                  />
                  <button
                    className="admin-table-action-button"
                    type="button"
                    onClick={() => handleAdminExport(getAdminExportSectionForDatabaseSection(activeAdminDatabaseSection))}
                    disabled={adminExportLoading === `${getAdminExportSectionForDatabaseSection(activeAdminDatabaseSection)}-csv`}
                  >
                    {adminExportLoading === `${getAdminExportSectionForDatabaseSection(activeAdminDatabaseSection)}-csv` ? "Exporting..." : "Export Section"}
                  </button>
                </div>
              </div>
              {adminLoading ? (
                <div className="admin-empty-state admin-loading-state">
                  <h4>Loading database tables</h4>
                  <p>Preparing the latest admin-safe table snapshots from the backend.</p>
                </div>
              ) : null}
              {adminError ? <p className="error-text">{adminError}</p> : null}
              {!adminLoading && adminTables.length === 0 ? (
                <div className="workspace-mini-card">
                  <h4>No tables available</h4>
                  <p>The admin overview did not return any tables for this environment.</p>
                </div>
              ) : (
                <div className="workspace-form-stack">
                  {(() => {
                    const databaseSections = getDatabaseSections();
                    const selectedDatabaseSection =
                      databaseSections.find((section) => section.id === activeAdminDatabaseSection) ||
                      databaseSections[0];

                    return (
                      <>
                        <div className="contact-request-category-row">
                          {databaseSections.map((section) => (
                            <button
                              key={section.id}
                              type="button"
                              className={`contact-request-category-button ${selectedDatabaseSection?.id === section.id ? "active" : ""}`}
                              onClick={() => setActiveAdminDatabaseSection(section.id)}
                            >
                              <span>{section.title}</span>
                              <strong>
                                {section.tables.reduce((sum, table) => sum + (table.rowCount || 0), 0)}
                              </strong>
                            </button>
                          ))}
                        </div>

                        {selectedDatabaseSection ? (
                          <section className="admin-db-group">
                            <div className="admin-db-group-header">
                              <div>
                                <h4>{selectedDatabaseSection.title}</h4>
                                <p>{selectedDatabaseSection.copy}</p>
                              </div>
                            </div>
                            {selectedDatabaseSection.id === "requests" ? (
                              <>
                                <div className="contact-request-category-row">
                                  {(() => {
                                    const requestFilters = getAdminDatabaseRequestFilters();
                                    const requestTable = selectedDatabaseSection.tables.find(
                                      (table) => table.tableName === "contact_requests"
                                    );
                                    const requestRows = requestTable?.rows || [];

                                    return requestFilters.map((filter) => {
                                      const count =
                                        filter.id === "All"
                                          ? requestRows.length
                                          : requestRows.filter(
                                              (row) => (row.status || "In Progress") === filter.id
                                            ).length;

                                      return (
                                        <button
                                          key={filter.id}
                                          type="button"
                                          className={`contact-request-category-button ${activeAdminDatabaseRequestFilter === filter.id ? "active" : ""}`}
                                          onClick={() => setActiveAdminDatabaseRequestFilter(filter.id)}
                                        >
                                          <span>{filter.title}</span>
                                          <strong>{count}</strong>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                                <div className="contact-request-category-row">
                                  {(() => {
                                    const requestTable = selectedDatabaseSection.tables.find(
                                      (table) => table.tableName === "contact_requests"
                                    );
                                    const requestRows = (requestTable?.rows || []).filter(
                                      (row) =>
                                        activeAdminDatabaseRequestFilter === "All" ||
                                        (row.status || "In Progress") === activeAdminDatabaseRequestFilter
                                    );
                                    const categoryFilters = getAdminDatabaseRequestCategoryFilters();

                                    return categoryFilters.map((filter) => {
                                      const count =
                                        filter.id === "All"
                                          ? requestRows.length
                                          : requestRows.filter(
                                              (row) => (row.category || "").toLowerCase() === filter.id
                                            ).length;

                                      return (
                                        <button
                                          key={filter.id}
                                          type="button"
                                          className={`contact-request-category-button ${activeAdminDatabaseRequestCategory === filter.id ? "active" : ""}`}
                                          onClick={() => setActiveAdminDatabaseRequestCategory(filter.id)}
                                        >
                                          <span>{filter.title}</span>
                                          <strong>{count}</strong>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                              </>
                            ) : null}
                                <div className="workspace-form-stack">
                              {selectedDatabaseSection.tables.map((table) => {
                                const visibleColumns = getVisibleColumnsForTable(
                                  table,
                                  selectedDatabaseSection.id === "subscriptions" && table.tableName === "users"
                                    ? ["public_user_code", "full_name", "email", "subscription_plan_name", "subscription_status", "subscription_expires_at"]
                                    : selectedDatabaseSection.id === "subscriptions" && table.tableName === "subscription_transactions"
                                      ? ["transaction_code", "linked_user_name", "plan_name", "amount", "currency", "billing_cycle", "status", "activated_at", "expires_at", "razorpay_payment_id"]
                                      : selectedDatabaseSection.id === "requests" && table.tableName === "contact_requests"
                                        ? ["request_code", "linked_user_name", "category", "title", "status", "created_at"]
                                        : selectedDatabaseSection.columns
                                );
                                const tableColumns =
                                  selectedDatabaseSection.id === "requests" && table.tableName === "contact_requests"
                                    ? [...visibleColumns, "__open_request__"]
                                    : selectedDatabaseSection.id === "accounts" && table.tableName === "users"
                                      ? [...visibleColumns, "__view_user__"]
                                    : visibleColumns;
                                const filteredRows =
                                  selectedDatabaseSection.id === "requests" && table.tableName === "contact_requests"
                                    ? (table.rows || []).filter(
                                        (row) =>
                                          (activeAdminDatabaseRequestFilter === "All" ||
                                            (row.status || "In Progress") === activeAdminDatabaseRequestFilter) &&
                                          (activeAdminDatabaseRequestCategory === "All" ||
                                            (row.category || "").toLowerCase() === activeAdminDatabaseRequestCategory) &&
                                          matchesAdminSearch(row, adminDatabaseSearch)
                                      )
                                    : (table.rows || []).filter((row) => matchesAdminSearch(row, adminDatabaseSearch));
                                return (
                                  <section key={table.tableName} className="admin-table-section">
                                    <div className="admin-table-header">
                                      <div>
                                        <h4>{prettifyKey(table.tableName)}</h4>
                                        {selectedDatabaseSection.id === "requests" && table.tableName === "contact_requests" ? null : (
                                          <p>{`${table.rowCount || 0} rows`}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="admin-table-scroll">
                                      <table className="admin-data-table">
                                        <thead>
                                          <tr>
                                            {tableColumns.map((columnName) => (
                                              <th key={columnName}>
                                                <span>
                                                  {columnName === "__open_request__"
                                                    ? "Open Request"
                                                    : columnName === "__view_user__"
                                                      ? "View User"
                                                      : prettifyKey(columnName)}
                                                </span>
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filteredRows.length > 0 ? (
                                            filteredRows.slice(0, 10).map((row, index) => (
                                              <tr key={`${table.tableName}-${index}`}>
                                                {tableColumns.map((columnName) => (
                                                  <td key={`${table.tableName}-${index}-${columnName}`}>
                                                    {columnName === "__open_request__" ? (
                                                      <button
                                                        type="button"
                                                        className="admin-table-action-button"
                                                        onClick={() => openContactRequestFromAdmin(row)}
                                                      >
                                                        Open Request
                                                      </button>
                                                    ) : columnName === "__view_user__" ? (
                                                      <button
                                                        type="button"
                                                        className="admin-table-action-button"
                                                        onClick={() => setSelectedAdminUserId(row.id)}
                                                      >
                                                        View User
                                                      </button>
                                                    ) : (
                                                      renderDatabaseCell(columnName, row[columnName])
                                                    )}
                                                  </td>
                                                ))}
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td colSpan={tableColumns.length} className="admin-table-empty-row">
                                                No rows matched the current search.
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                );
                              })}
                            </div>
                          </section>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              )}
            </article>
          </div>
        </>
      );
    }

    if (selectedInfoPage === "profile") {
      const profileCards =
        activeInfoTab === "overview"
          ? [
              { title: "Full Name", text: profileName },
              { title: "Account Email", text: profileEmail },
              { title: "Plan", text: subscriptionPlanName },
              { title: "Member ID", text: currentUser?.publicUserCode || "Not assigned" },
              { title: "Workspace Role", text: "Account Owner" },
              { title: "Status", text: subscriptionStatusLabel },
              { title: "Joined", text: profileJoined },
            ]
          : activeInfoTab === "account"
            ? [
                { title: "Username", text: profileUsername },
                { title: "Alternate Email", text: profileAlternateEmail },
                { title: "Mobile", text: profileMobile },
                { title: "Date of Birth", text: profileDateOfBirth },
                { title: "Gender", text: profileGender },
                { title: "Referral Code", text: profileReferralCode },
              ]
          : activeInfoTab === "subscription"
              ? [
                  { title: "Current Plan", text: subscriptionPlanName },
                  { title: "Billing Price", text: subscriptionPriceLabel },
                  { title: "Billing Cycle", text: subscriptionBillingCycle },
                  { title: "Activated On", text: subscriptionActivationLabel },
                  { title: "Valid Till", text: subscriptionExpiryLabel },
                  { title: "Payment Method", text: subscriptionStatus === "premium" ? "Razorpay secure checkout" : "Not added" },
                ]
              : activeInfoTab === "usage"
                ? [
                    { title: "Documents Processed", text: "128 this month" },
                    { title: "Images Generated", text: "46 this month" },
                    { title: "Detection Runs", text: "31 this month" },
                    { title: "Storage Used", text: "2.4 GB of 10 GB" },
                  ]
              : activeInfoTab === "activity"
                ? [
                    { title: "Latest Login", text: "Jaipur, India - 2026-04-04 05:50" },
                    { title: "Previous Login", text: "Mumbai, India - 2026-04-03 21:12" },
                    { title: "Last Workspace Action", text: "Viewed Document Retrieval" },
                  ]
                : [
                    { title: "Password Status", text: "Updated recently" },
                    { title: "Two-Step Verification", text: "Enabled" },
                    { title: "Recovery Email", text: profileAlternateEmail },
                    { title: "Security Question", text: profileSecurityQuestion },
                    { title: "Security Answer", text: profileSecurityAnswer },
                    { title: "Recent Device", text: "Windows Chrome Desktop" },
                  ];

      return (
        <>
          <div className="insight-section">
            <div className="insight-card">
              <h3 className="tool-title">{activeInfoContent.heading}</h3>
              <p className="tool-copy">{infoConfig.message}</p>
            </div>
          </div>
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                {profileCards.map((card) => (
                  <div key={card.title} className="workspace-mini-card">
                    <h4>{card.title}</h4>
                    <p>{card.text}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </>
      );
    }

    if (selectedInfoPage === "settings") {
      return (
        <>
          <div className="insight-section">
            <div className="insight-card">
              <h3 className="tool-title">{activeInfoContent.heading}</h3>
              <p className="tool-copy">{infoConfig.message}</p>
            </div>
          </div>
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <SettingsPanel activeTab={activeInfoTab} currentUser={currentUser} onUserUpdate={onUserUpdate} onAccountDeleted={onAccountDeleted} />
            </article>
          </div>
        </>
      );
    }

    if (selectedInfoPage === "pricing") {
      return (
        <>
          <div className="insight-section">
            <div className="insight-card">
              <h3 className="tool-title">{activeInfoContent.heading}</h3>
              <p className="tool-copy">{infoConfig.message}</p>
            </div>
          </div>
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="pricing-page-shell">
                <div className="pricing-page-hero">
                  <div>
                    <span className="pricing-page-kicker">Secure INR Billing</span>
                    <h4>{activeInfoContent.heading}</h4>
                    <p>{activeInfoContent.description}</p>
                  </div>
                </div>

                <div className="pricing-plan-grid">
                  {activePricingPlans.map((plan) => {
                    const planState = paymentStatus[plan.id];
                    const isProcessing = activePlanPurchaseId === plan.id;
                    const isCurrentPlan = subscriptionPlanName === plan.title && hasActiveSubscription;

                    return (
                      <div key={plan.id} className={`workspace-mini-card pricing-plan-card ${plan.accent}`}>
                        <div className="pricing-plan-card-top">
                          <div className="pricing-plan-card-copy">
                            <span className="pricing-plan-badge">
                              {plan.accent === "popular" ? "Most Popular" : plan.accent === "premium" ? "Premium" : "Active Plan"}
                            </span>
                            <h4>{plan.title}</h4>
                            <p>{plan.tagline}</p>
                          </div>
                          <div className="pricing-plan-visual">
                            <div className="pricing-plan-visual-price">{plan.priceLabel}</div>
                            <div className="pricing-plan-visual-bottom">
                              <strong>{plan.title}</strong>
                              <span>{plan.cadence}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pricing-plan-feature-list">
                          {plan.features.map((feature) => (
                            <div key={feature} className="pricing-plan-feature-item">
                              {feature}
                            </div>
                          ))}
                        </div>

                        <div className="pricing-plan-footer">
                          <p className="pricing-plan-note">{plan.note}</p>
                          <div className="pricing-plan-trust-row">
                            <span>Instant activation</span>
                            <span>Encrypted checkout</span>
                          </div>
                        </div>
                        {planState?.text ? (
                          <p className={planState.type === "success" ? "success-text" : "error-text"}>
                            {planState.type === "success" ? `Verified: ${planState.text}` : planState.text}
                          </p>
                        ) : null}

                        <button
                          className="primary-button pricing-plan-button"
                          type="button"
                          onClick={() => handlePlanPurchase(plan)}
                          disabled={!!activePlanPurchaseId || hasActiveSubscription}
                        >
                          {isCurrentPlan ? "Premium Active" : hasActiveSubscription ? "Subscription Active" : isProcessing ? "Opening Razorpay..." : "Buy Plan"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          </div>
        </>
      );
    }

    if (selectedInfoPage === "contact") {
      const groupedContactRequests = contactCategoryOrder.map((categoryId) => ({
        categoryId,
        label: INFO_PAGE_CONFIG.contact.tabs.find((tab) => tab.id === categoryId)?.label || categoryId,
        items: contactRequests.filter((requestItem) => requestItem.category === categoryId),
      }));

      if (activeInfoTab === "submittedRequests") {
        const submittedCategoryTabs = groupedContactRequests.map((group) => ({
          ...group,
          heading: INFO_PAGE_CONFIG.contact.tabs.find((tab) => tab.id === group.categoryId)?.heading || group.label,
        }));
        const selectedSubmittedGroup =
          submittedCategoryTabs.find((group) => group.categoryId === activeSubmittedCategory) ||
          submittedCategoryTabs[0];

        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-form-stack">
                <div className="workspace-mini-card contact-request-hero">
                  <h4>Submitted Requests</h4>
                  <p>Choose a request category to view its saved inquiries, ticket IDs, and request details in one place.</p>
                </div>

                {contactRequestsLoading ? (
                  <p className="tool-copy">Loading requests...</p>
                ) : (
                  <div className="workspace-form-stack">
                    <div className="contact-request-category-row">
                      {submittedCategoryTabs.map((group) => (
                        <button
                          key={group.categoryId}
                          type="button"
                          className={`contact-request-category-button ${selectedSubmittedGroup?.categoryId === group.categoryId ? "active" : ""}`}
                          onClick={() => setActiveSubmittedCategory(group.categoryId)}
                        >
                          <span>{group.label}</span>
                          <strong>{group.items.length}</strong>
                        </button>
                      ))}
                    </div>

                    {selectedSubmittedGroup ? (
                      <div className="contact-request-panel">
                        {selectedSubmittedGroup.items.length > 0 ? (
                          <div className="contact-request-card-scroll">
                            <div className="contact-request-card-grid">
                              {selectedSubmittedGroup.items.map((requestItem) => (
                                <div
                                  key={requestItem.id}
                                  id={`contact-request-${requestItem.id}`}
                                  className={`contact-request-card ${focusedContactRequestId === requestItem.id ? "is-focused" : ""}`}
                                >
                                  <div className="contact-request-card-head">
                                    <div>
                                      <p className="contact-request-type">{requestItem.title || selectedSubmittedGroup.label}</p>
                                      <div className="contact-request-id-badge">
                                        {requestItem.requestCode || "Feedback Request"}
                                      </div>
                                    </div>
                                    <span className={`contact-request-status-chip status-${formatRequestStatusClass(requestItem.status)}`}>
                                      {requestItem.status || "In Progress"}
                                    </span>
                                  </div>

                                  <div className="contact-request-meta">
                                    <div className="contact-request-meta-item">
                                      <span>Created</span>
                                      <strong>
                                        {new Date(requestItem.createdAt).toLocaleString("en-GB", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </strong>
                                    </div>
                                    <div className="contact-request-meta-item">
                                      <span>Process</span>
                                      <strong>{requestItem.status || "In Progress"}</strong>
                                    </div>
                                  </div>

                                  {requestItem.adminMessage ? (
                                    <div className="contact-request-message-box">
                                      <span>Admin Message</span>
                                      <strong>{requestItem.adminMessage}</strong>
                                    </div>
                                  ) : null}

                                  <div className="contact-request-details">
                                    {Object.entries(requestItem.values).map(([key, value]) => (
                                      <div key={key} className="contact-request-detail-item">
                                        <span>{key}</span>
                                        <strong>{value || "Not provided"}</strong>
                                      </div>
                                    ))}
                                  </div>

                                  <button className="contact-request-delete-button" type="button" onClick={() => handleContactDelete(requestItem.id)}>
                                    Delete Request
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="contact-request-empty-card">
                            <h5>No {selectedSubmittedGroup.label} requests yet</h5>
                            <p>Your submitted {selectedSubmittedGroup.label.toLowerCase()} requests will appear here with their saved details.</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </article>
          </div>
        );
      }

      return (
        <div className="content-grid single-column">
          <article className="tool-card workspace-copy-card">
            <div className="workspace-form-stack">
              <div className="workspace-mini-card">
                <h4>{activeInfoContent.label}</h4>
                <p>Fill the form, submit below, and track request IDs by category.</p>
              </div>

              <div className="workspace-form-stack">
                {activeInfoContent.form.map((field) => (
                  field === "Rate Our Service" ? (
                    <select
                      key={field}
                      className="auth-input workspace-static-input"
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    >
                      <option value="">{field}</option>
                      <option>Excellent</option>
                      <option>Good</option>
                      <option>Fair</option>
                      <option>Poor</option>
                    </select>
                  ) : field === "Issue Type" ? (
                    <select
                      key={field}
                      className="auth-input workspace-static-input"
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    >
                      <option value="">{field}</option>
                      <option>Login Problem</option>
                      <option>Payment Issue</option>
                      <option>Bug Report</option>
                      <option>Other</option>
                    </select>
                  ) : field === "Date of Experience" ? (
                    <input
                      key={field}
                      className="auth-input workspace-static-input"
                      type="date"
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    />
                  ) : (
                    <input
                      key={field}
                      className="auth-input workspace-static-input"
                      type={
                        field.toLowerCase().includes("email")
                          ? "email"
                          : field.toLowerCase().includes("phone")
                            ? "tel"
                            : "text"
                      }
                      placeholder={field}
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    />
                  )
                ))}
                <textarea
                  className="question-input workspace-static-textarea"
                  rows={4}
                  placeholder={activeInfoContent.textarea}
                  value={getContactValue(activeInfoTab, activeInfoContent.textarea)}
                  onChange={(event) => setContactValue(activeInfoTab, activeInfoContent.textarea, event.target.value)}
                />
                {activeContactStatus.text ? (
                  <p className={activeContactStatus.type === "success" ? "success-text" : "error-text"}>
                    {activeContactStatus.type === "success" ? `✓ ${activeContactStatus.text}` : activeContactStatus.text}
                  </p>
                ) : null}
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    handleContactSubmit(
                      activeInfoTab,
                      activeInfoContent.label || activeInfoContent.heading,
                      activeInfoContent.form,
                      activeInfoContent.textarea
                    )
                  }
                  disabled={contactSubmitting}
                >
                  {contactSubmitting ? "Submitting..." : activeInfoContent.button}
                </button>
              </div>
            </div>
          </article>
        </div>
      );
    }

    return (
      <>
        <div className="insight-section">
          <div className="insight-card">
            <h3 className="tool-title">{activeInfoContent.heading}</h3>
            <p className="tool-copy">{infoConfig.message}</p>
          </div>
        </div>

        <div className="content-grid single-column">
          <article className="tool-card workspace-copy-card">
            {activeInfoContent.body
              ? activeInfoContent.body.map((paragraph) => (
                  <p key={paragraph} className="tool-copy workspace-copy-paragraph">
                    {paragraph}
                  </p>
                ))
              : null}

            {activeInfoContent.list ? (
              <ul className="workspace-copy-list">
                {activeInfoContent.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            {activeInfoContent.qna ? (
              <div className="workspace-qna-grid">
                {activeInfoContent.qna.map(([questionItem, answerItem]) => (
                  <div key={questionItem} className="workspace-mini-card">
                    <h4>{questionItem}</h4>
                    <p>{answerItem}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {activeInfoContent.cards ? (
              <div className="workspace-info-grid">
                {activeInfoContent.cards.map((card) => (
                  <div key={card.title} className="workspace-mini-card">
                    <h4>{card.title}</h4>
                    <p>{card.text}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {activeInfoContent.form ? (
              <div className="workspace-form-stack">
                {activeInfoContent.form.map((field) => (
                  field === "Rate Our Service" ? (
                    <select
                      key={field}
                      className="auth-input workspace-static-input"
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    >
                      <option value="">{field}</option>
                      <option>Excellent</option>
                      <option>Good</option>
                      <option>Fair</option>
                      <option>Poor</option>
                    </select>
                  ) : field === "Issue Type" ? (
                    <select
                      key={field}
                      className="auth-input workspace-static-input"
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    >
                      <option value="">{field}</option>
                      <option>Login Problem</option>
                      <option>Payment Issue</option>
                      <option>Bug Report</option>
                      <option>Other</option>
                    </select>
                  ) : field === "Date of Experience" ? (
                    <input
                      key={field}
                      className="auth-input workspace-static-input"
                      type="date"
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    />
                  ) : (
                    <input
                      key={field}
                      className="auth-input workspace-static-input"
                      type={
                        field.toLowerCase().includes("email")
                          ? "email"
                          : field.toLowerCase().includes("phone")
                            ? "tel"
                            : "text"
                      }
                      placeholder={field}
                      value={getContactValue(activeInfoTab, field)}
                      onChange={(event) => setContactValue(activeInfoTab, field, event.target.value)}
                    />
                  )
                ))}
                <textarea
                  className="question-input workspace-static-textarea"
                  rows={4}
                  placeholder={activeInfoContent.textarea}
                  value={getContactValue(activeInfoTab, activeInfoContent.textarea)}
                  onChange={(event) => setContactValue(activeInfoTab, activeInfoContent.textarea, event.target.value)}
                />
                {selectedInfoPage !== "contact" && contactStatus[activeInfoTab]?.text ? (
                  <p className={contactStatus[activeInfoTab].type === "success" ? "success-text" : "error-text"}>
                    {contactStatus[activeInfoTab].type === "success" ? `✓ ${contactStatus[activeInfoTab].text}` : contactStatus[activeInfoTab].text}
                  </p>
                ) : null}
                {selectedInfoPage !== "contact" ? (
                  <button className="primary-button" type="button">
                    {activeInfoContent.button}
                  </button>
                ) : null}
              </div>
            ) : null}

            {activeInfoContent.button && !activeInfoContent.form ? (
              <button className="primary-button workspace-copy-action" type="button">
                  {activeInfoContent.button}
              </button>
            ) : null}
          </article>
        </div>
      </>
    );
  };

  const selectedAdminUserDetails = getAdminUserDetails(selectedAdminUserId);
  const selectedAdminUserDetailCards = selectedAdminUserDetails
    ? [
        { title: "Full Name", text: selectedAdminUserDetails.userRow.full_name || "Not available" },
        { title: "Member ID", text: selectedAdminUserDetails.userRow.public_user_code || "Not available" },
        { title: "Username", text: selectedAdminUserDetails.userRow.username || "Not available" },
        { title: "Email", text: selectedAdminUserDetails.userRow.email || "Not available" },
        { title: "Alternate Email", text: selectedAdminUserDetails.userRow.alternate_email || "Not available" },
        { title: "Mobile", text: selectedAdminUserDetails.userRow.mobile || "Not available" },
        { title: "Subscription Plan", text: selectedAdminUserDetails.userRow.subscription_plan_name || "Free Member" },
        { title: "Subscription Status", text: selectedAdminUserDetails.userRow.subscription_status || "free" },
        { title: "Valid Till", text: selectedAdminUserDetails.userRow.subscription_expires_at || "Not available" },
        { title: "Joined", text: selectedAdminUserDetails.userRow.created_at || "Not available" },
        { title: "Gender", text: selectedAdminUserDetails.userRow.gender || "Not available" },
        { title: "Date Of Birth", text: selectedAdminUserDetails.userRow.date_of_birth || "Not available" },
        { title: "Referral Code", text: selectedAdminUserDetails.userRow.referral_code || "Not available" },
        { title: "Email Verified", text: selectedAdminUserDetails.userRow.email_verified ? "Yes" : "No" },
        { title: "Mobile Verified", text: selectedAdminUserDetails.userRow.mobile_verified ? "Yes" : "No" },
        { title: "Security Question", text: selectedAdminUserDetails.userRow.security_question || "Not available" },
      ]
    : [];

  return (
    <section id="workspace" className="workspace-page">
      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <h1 className="sidebar-title">{infoConfig ? infoConfig.title : "Assistant"}</h1>
          <p className="sidebar-description">
            {infoConfig ? infoConfig.description : "Separate tools for retrieval, detection, and generation"}
          </p>

          <div className="sidebar-tabs">
            {infoConfig
              ? infoConfig.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`sidebar-tab ${activeInfoTab === tab.id ? "active" : ""}`}
                    onClick={() =>
                      setInfoTabs((current) => ({
                        ...current,
                        [selectedInfoPage]: tab.id,
                      }))
                    }
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))
              : (
                <>
                  <button className={`sidebar-tab ${activeSection === "document-retrieval" ? "active" : ""}`} onClick={() => setActiveSection("document-retrieval")} type="button">
                    Document Retrieval
                  </button>
                  <button className={`sidebar-tab ${activeSection === "object-detection" ? "active" : ""}`} onClick={() => setActiveSection("object-detection")} type="button">
                    Object Detection
                  </button>
                  <button className={`sidebar-tab ${activeSection === "image-generation" ? "active" : ""}`} onClick={() => setActiveSection("image-generation")} type="button">
                    Image Generation
                  </button>
                </>
              )}
          </div>

          {selectedInfoPage !== "settings" ? (
            <div className="sidebar-boost-card">
              <div className="sidebar-status">
                <h4>{infoConfig ? infoConfig.statusTitle : activeSection === "document-retrieval" ? "Document Retrieval Status" : activeSection === "object-detection" ? "Object Detection Status" : "Image Generation Status"}</h4>
                {selectedInfoPage === "contact" ? (
                  <div className="workspace-form-stack">
                    <div className="status-feed">
                      {infoConfig.statusItems.map((item) => (
                        <p key={item} className="status-item status-info">
                          {item}
                        </p>
                      ))}
                    </div>
                    {activeContactStatus.text ? (
                      <p className={activeContactStatus.type === "success" ? "success-text" : "error-text"}>
                        {activeContactStatus.type === "success" ? `✓ ${activeContactStatus.text}` : activeContactStatus.text}
                      </p>
                    ) : (
                      <p className="status-item status-info">Request status and IDs appear here after submit.</p>
                    )}
                  </div>
                ) : (
                  <div className="status-feed">
                    {infoConfig
                      ? infoConfig.statusItems.map((item) => (
                          <p key={item} className="status-item status-info">
                            {item}
                          </p>
                        ))
                      : statusContent}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="workspace-content">
          <div className="info-card">
            <p>{infoConfig ? infoConfig.message : workspaceMessage}</p>
          </div>

          <div className={`content-card ${activeSection === "object-detection" || activeSection === "image-generation" ? "object-detection-mode" : ""}`}>
            {infoConfig ? (
              renderInfoContent()
            ) : activeSection === "document-retrieval" ? (
              <DocumentRetrievalPanel
                answer={answer}
                askQuestion={askQuestion}
                hasQuestion={hasQuestion}
                isAsking={isAsking}
                isUploading={isUploading}
                pushStatus={pushStatus}
                question={question}
                selectedFile={selectedFile}
                setError={setError}
                setQuestion={setQuestion}
                setSelectedFile={setSelectedFile}
                uploadDocument={uploadDocument}
              />
            ) : activeSection === "object-detection" ? (
              <ObjectDetectionPanel />
            ) : (
              <ImageGenerationPanel />
            )}

            {(error || uploadStatus) && activeSection === "document-retrieval" && !infoConfig ? (
              <div>
                {error ? <p className="error-text">{error}</p> : null}
                {uploadStatus ? <p className="success-text">{uploadStatus}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {selectedAdminUserDetails ? (
        <div className="admin-user-modal-backdrop" onClick={() => setSelectedAdminUserId("")}>
          <div className="admin-user-modal" onClick={(event) => event.stopPropagation()}>
            <section className="admin-user-profile-panel">
              <div className="admin-user-profile-header">
                <div className="admin-user-profile-avatar">
                  {(selectedAdminUserDetails.userRow.full_name || selectedAdminUserDetails.userRow.email || "U").trim().charAt(0).toUpperCase()}
                </div>
                <div className="admin-user-profile-copy">
                  <h4>{selectedAdminUserDetails.userRow.full_name || "User Profile"}</h4>
                  <p>{selectedAdminUserDetails.userRow.email || "No email available"}</p>
                  <span>
                    {selectedAdminUserDetails.userRow.username || "No username"} | {selectedAdminUserDetails.userRow.mobile || "No mobile"}
                  </span>
                </div>
                <button
                  type="button"
                  className="admin-table-action-button"
                  onClick={() => setSelectedAdminUserId("")}
                >
                  Close
                </button>
              </div>

              <div className="workspace-info-grid">
                {selectedAdminUserDetailCards.map((card) => (
                  <div key={card.title} className="workspace-mini-card">
                    <h4>{card.title}</h4>
                    <p>{card.text}</p>
                  </div>
                ))}
              </div>

              <div className="admin-user-summary-grid">
                <div className="admin-user-summary-card">
                  <h4>Request Status Summary</h4>
                  {selectedAdminUserDetails.requestStatusCounts.map((item) => (
                    <p key={item.status}>
                      <strong>{item.status}:</strong> {item.count}
                    </p>
                  ))}
                  <p><strong>Total Requests:</strong> {selectedAdminUserDetails.userRequests.length}</p>
                </div>

                <div className="admin-user-summary-card">
                  <h4>Linked Providers</h4>
                  {selectedAdminUserDetails.userProviders.length > 0 ? selectedAdminUserDetails.userProviders.map((provider) => (
                    <p key={`${provider.user_id}-${provider.provider}`}>
                      <strong>{prettifyKey(provider.provider)}:</strong> {provider.email || provider.provider_id}
                    </p>
                  )) : <p>No linked providers found.</p>}
                </div>
              </div>

              <div className="admin-user-history-panel">
                <h4>User Timeline</h4>
                <div className="admin-user-history-list">
                  {selectedAdminUserDetails.timelineItems.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="admin-user-history-item">
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default WorkspacePage;
