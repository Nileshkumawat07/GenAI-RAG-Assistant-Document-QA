import React, { useEffect, useMemo, useState } from "react";

import DocumentRetrievalPanel from "../document-retrieval/DocumentRetrievalPanel";
import ImageGenerationPanel from "../image-generation/ImageGenerationPanel";
import ObjectDetectionPanel from "../object-detection/ObjectDetectionPanel";
import SettingsPanel from "./SettingsPanel";
import { downloadAdministrationExport, getAdminMysqlOverview, normalizeAuthUser, updateManagementAccess } from "../auth/authApi";
import {
  adminDeleteContactRequest,
  adminUpdateContactRequestStatus,
  createContactRequest,
  deleteContactRequest,
  listContactRequests,
} from "../info/contactApi";
import {
  bulkUpdateManagementRequests,
  createManagementNote,
  createReplyTemplate,
  exportManagementReport,
  getManagementOverview,
} from "./managementApi";
import {
  assignAdminRole,
  createAdminCommunicationTemplate,
  forceAdminPasswordReset,
  getAdminCenterOverview,
  lockAdminUser,
  reactivateAdminUser,
  runAdminDatabaseQuery,
  saveAdminContent,
  updateBillingAdministration,
} from "./adminCenterApi";
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
      { id: "users", label: "Users", heading: "User Administration Center" },
      { id: "roles", label: "Roles", heading: "Role And Permission System" },
      { id: "sla", label: "SLA", heading: "Ticket SLA Dashboard" },
      { id: "assignments", label: "Assignments", heading: "Assignment Engine" },
      { id: "analytics", label: "Analytics", heading: "Advanced Analytics" },
      { id: "billing", label: "Billing", heading: "Billing Administration" },
      { id: "communications", label: "Communications", heading: "Communication Hub" },
      { id: "compliance", label: "Compliance", heading: "Compliance And Audit" },
      { id: "operations", label: "Operations", heading: "System Operations Panel" },
      { id: "content", label: "Content", heading: "Content And Knowledge Admin" },
      { id: "security", label: "Security", heading: "Abuse And Security Controls" },
      { id: "automation", label: "Automation", heading: "Workflow Automation" },
      { id: "notifications", label: "Notifications", heading: "Admin Notifications" },
      { id: "reports", label: "Reports", heading: "Report Builder" },
      { id: "management", label: "Management", heading: "Management Users" },
      { id: "database", label: "Database", heading: "MySQL Table Overview" },
    ],
  },
  management: {
    title: "Management",
    description: "Review request operations and support handling",
    message: "Manage submitted requests through the same workspace layout used for administration, without database access.",
    statusTitle: "Management Controls",
    statusItems: ["Management session active", "Request moderation enabled", "Support queue ready"],
    tabs: [
      { id: "overview", label: "Overview", heading: "Management Overview" },
      { id: "requests", label: "Contact Requests", heading: "Contact Request Queue" },
      { id: "users", label: "Users", heading: "Management Users" },
      { id: "support", label: "Support", heading: "Support Request Table" },
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
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminExportLoading, setAdminExportLoading] = useState("");
  const [activeAdminRequestSection, setActiveAdminRequestSection] = useState("In Progress");
  const [activeAdminDatabaseSection, setActiveAdminDatabaseSection] = useState("accounts");
  const [activeAdminDatabaseRequestFilter, setActiveAdminDatabaseRequestFilter] = useState("All");
  const [activeAdminDatabaseRequestCategory, setActiveAdminDatabaseRequestCategory] = useState("All");
  const [focusedContactRequestId, setFocusedContactRequestId] = useState("");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [managementToggleUserId, setManagementToggleUserId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState({});
  const [activePlanPurchaseId, setActivePlanPurchaseId] = useState("");
  const [managementSummary, setManagementSummary] = useState({
    totalManagementUsers: 0,
    openRequests: 0,
    inReviewRequests: 0,
    completedToday: 0,
  });
  const [managementUsers, setManagementUsers] = useState([]);
  const [managementNotes, setManagementNotes] = useState([]);
  const [replyTemplates, setReplyTemplates] = useState([]);
  const [recentManagementActions, setRecentManagementActions] = useState([]);
  const [managementActivityDashboard, setManagementActivityDashboard] = useState([]);
  const [managementUserSearch, setManagementUserSearch] = useState("");
  const [managementAccessFilter, setManagementAccessFilter] = useState("all");
  const [managementRequestCountFilter, setManagementRequestCountFilter] = useState("all");
  const [selectedBulkRequestIds, setSelectedBulkRequestIds] = useState([]);
  const [requestManagerAssignments, setRequestManagerAssignments] = useState({});
  const [requestTemplateSelections, setRequestTemplateSelections] = useState({});
  const [managementNoteDrafts, setManagementNoteDrafts] = useState({});
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [managementReportLoading, setManagementReportLoading] = useState("");
  const [adminCenterData, setAdminCenterData] = useState(null);
  const [adminDatabaseQuery, setAdminDatabaseQuery] = useState("SELECT id, full_name, email FROM users");
  const [adminDatabaseQueryResult, setAdminDatabaseQueryResult] = useState(null);
  const [adminAuditFocusId, setAdminAuditFocusId] = useState("");
  const [managementAuditFocusId, setManagementAuditFocusId] = useState("");
  const [adminContentDraft, setAdminContentDraft] = useState({
    pageKey: "about",
    sectionKey: "company",
    title: "",
    bodyJson: "{\"body\":[]}",
    isPublished: true,
  });
  const [adminCommunicationDraft, setAdminCommunicationDraft] = useState({
    channel: "email",
    category: "support",
    title: "",
    body: "",
    requiresApproval: false,
  });

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
  const isManagement = !!currentUser?.isManagement;
  const isManagementPage = selectedInfoPage === "management";
  const canAccessManagement = isAdmin || isManagement;
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

        if (tables.length === 0) {
          return null;
        }

        const filteredTables = section.rowFilter
          ? tables
            .map((table) => ({
              ...table,
              rows: (table.rows || []).filter(section.rowFilter),
              rowCount: (table.rows || []).filter(section.rowFilter).length,
            }))
            .filter((table) => (table.rowCount || 0) > 0)
          : tables;

        return filteredTables.length > 0 ? { ...section, tables: filteredTables } : null;
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
  const getAdminSupportCategoryFilters = () => {
    const orderedCategories = ["general", "business", "feedback", "technical", "partnership", "media"];

    return orderedCategories.map((category) => ({
      id: category,
      title: prettifyKey(category),
    }));
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
    const handledRequests = adminRequests.filter((row) => row.assignedManagerUserId === userId);
    const userProviders = (providersTable?.rows || []).filter((row) => row.user_id === userId);
    const managementMeta = managementUsers.find((item) => item.id === userId) || null;
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
      ...(managementMeta?.managementGrantedAt ? [{
        title: "Management Access Granted",
        text: `${managementMeta.managementGrantedAt} | ${managementMeta.managementGrantedByName || "Unknown admin"}`,
      }] : []),
      ...userRequests.slice(0, 6).map((requestRow) => ({
        title: `${prettifyKey(requestRow.category || "request")} request`,
        text: `${requestRow.status || "In Progress"} | ${requestRow.created_at || "Unknown date"}`,
      })),
      ...handledRequests.slice(0, 6).map((requestRow) => ({
        title: `Handled ${prettifyKey(requestRow.category || "request")}`,
        text: `${requestRow.status || "In Progress"} | ${requestRow.requestCode || requestRow.id}`,
      })),
      ...userProviders.slice(0, 4).map((providerRow) => ({
        title: `Linked ${prettifyKey(providerRow.provider || "provider")}`,
        text: providerRow.email || providerRow.provider_id || "Connected provider",
      })),
    ];

    return {
      userRow,
      userRequests,
      handledRequests,
      userProviders,
      managementMeta,
      requestStatusCounts,
      timelineItems,
    };
  };

  const managementEligibleUsers = managementUsers.filter((item) => item.isManagement);
  const filteredManagementUsers = managementEligibleUsers.filter((item) => {
    const matchesSearch = matchesAdminSearch(
      {
        fullName: item.fullName,
        email: item.email,
        username: item.username,
        requestCount: item.requestCount,
        accessSuspended: item.accessSuspended,
      },
      managementUserSearch
    );
    const matchesAccess =
      managementAccessFilter === "all" ||
      (managementAccessFilter === "active" && !item.accessSuspended) ||
      (managementAccessFilter === "suspended" && item.accessSuspended);
    const matchesRequestCount =
      managementRequestCountFilter === "all" ||
      (managementRequestCountFilter === "assigned" && item.requestCount > 0) ||
      (managementRequestCountFilter === "idle" && item.requestCount === 0);
    return matchesSearch && matchesAccess && matchesRequestCount;
  });
  const adminCenterPanels = adminCenterData || {};
  const adminUsersPanel = adminCenterPanels.userAdministration || { users: [], archivedUsers: [] };
  const adminRolesPanel = adminCenterPanels.rolesAndPermissions || { roles: [], permissions: [], assignments: [] };
  const adminSlaPanel = adminCenterPanels.ticketSlaDashboard || { overdueQueue: [], breachedQueue: [], agingBuckets: [], statusCounts: {} };
  const adminAssignmentsPanel = adminCenterPanels.assignmentEngine || { managerLoad: [], assignmentHistory: [], queueOwnership: [] };
  const adminAnalyticsPanel = adminCenterPanels.advancedAnalytics || { categoryHeatmap: [], completionFunnel: {}, subscriptionConversions: {} };
  const adminBillingPanel = adminCenterPanels.billingAdministration || { transactions: [], billingNotes: [] };
  const adminCommunicationsPanel = adminCenterPanels.communicationHub || { templates: [], logs: [] };
  const adminCompliancePanel = adminCenterPanels.complianceAndAudit || { auditLogs: [] };
  const adminOperationsPanel = adminCenterPanels.systemOperationsPanel || {};
  const adminContentPanel = adminCenterPanels.contentAndKnowledgeAdmin || { entries: [] };
  const adminDatabaseToolsPanel = adminCenterPanels.databaseSafetyTools || { tables: [] };
  const adminSecurityPanel = adminCenterPanels.abuseAndSecurityControls || { securityEvents: [] };
  const adminAutomationPanel = adminCenterPanels.workflowAutomation || { rules: [] };
  const adminNotificationsPanel = adminCenterPanels.adminNotifications || { items: [], unreadCount: 0 };
  const adminReportsPanel = adminCenterPanels.reportBuilder || { presets: [], formats: [] };
  const filteredAdminAuditLogs = adminAuditLogs.filter((item) =>
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
  const adminCenterUsers = adminUsersPanel.users || [];
  const filteredAdminCenterUsers = adminCenterUsers.filter((user) =>
    matchesAdminSearch(
      {
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        roles: (user.roles || []).join(" "),
      },
      adminUserSearch
    )
  );
  const managementTableUsers = ((adminTables.find((table) => table.tableName === "users")?.rows || []))
    .filter((row) => !row.is_admin && !row.is_management);
  const filteredManagementTableUsers = managementTableUsers.filter((row) =>
    matchesAdminSearch(
      {
        fullName: row.full_name,
        username: row.username,
        email: row.email,
        mobile: row.mobile,
        publicUserCode: row.public_user_code,
      },
      managementUserSearch
    )
  );
  const selectedAdminAuditLog = filteredAdminAuditLogs.find((item) => item.id === adminAuditFocusId) || filteredAdminAuditLogs[0] || null;
  const selectedManagementAction =
    recentManagementActions.find((item) => item.id === managementAuditFocusId) || recentManagementActions[0] || null;

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
    if (!canAccessManagement) {
      return;
    }

    try {
      setAdminLoading(true);
      setAdminError("");
      const [mysqlOverview, managementOverview, adminCenterOverview] = await Promise.all([
        getAdminMysqlOverview(),
        getManagementOverview(),
        isAdmin ? getAdminCenterOverview() : Promise.resolve(null),
      ]);
      setAdminTables(mysqlOverview.tables || []);
      setAdminStatusOptions(mysqlOverview.statusOptions || []);
      setAdminAuditLogs(managementOverview.recentActions || mysqlOverview.auditLogs || []);
      setAdminRenewalReminders(mysqlOverview.renewalReminders || []);
      setAdminRequests(managementOverview.requests || []);
      setManagementSummary(managementOverview.summary || {
        totalManagementUsers: 0,
        openRequests: 0,
        inReviewRequests: 0,
        completedToday: 0,
      });
      setManagementUsers(managementOverview.managementUsers || []);
      setManagementNotes(managementOverview.notes || []);
      setReplyTemplates(managementOverview.replyTemplates || []);
      setRecentManagementActions(managementOverview.recentActions || []);
      setManagementActivityDashboard(managementOverview.activityDashboard || []);
      setAdminReplyDrafts(
        Object.fromEntries(
          (managementOverview.requests || []).map((item) => [item.id, item.adminMessage || ""])
        )
      );
      setRequestManagerAssignments(
        Object.fromEntries(
          (managementOverview.requests || []).map((item) => [item.id, item.assignedManagerUserId || ""])
        )
      );
      setAdminCenterData(adminCenterOverview);
    } catch (loadError) {
      setAdminError(loadError.message || "Failed to load administration data.");
    } finally {
      setAdminLoading(false);
    }
  };

  const openContactRequestFromAdmin = (requestRow) => {
    const accessPage = selectedInfoPage === "management" ? "management" : "administration";
    setInfoTabs((current) => ({
      ...current,
      [accessPage]: "requests",
    }));
    setActiveAdminRequestSection(requestRow.status || "In Progress");
    setFocusedContactRequestId(requestRow.id);
  };

  const clearFocusedContactRequest = (requestId) => {
    setFocusedContactRequestId((current) => (current === requestId || !requestId ? "" : current));
  };

  const resetAdministrationPanelState = () => {
    setAdminRequestSearch("");
    setAdminSupportSearch("");
    setAdminDatabaseSearch("");
    setAdminAuditSearch("");
    setManagementUserSearch("");
    setManagementAccessFilter("all");
    setManagementRequestCountFilter("all");
    setAdminExportLoading("");
    setManagementReportLoading("");
    setActiveAdminRequestSection("In Progress");
    setActiveAdminDatabaseSection("accounts");
    setActiveAdminDatabaseRequestFilter("All");
    setActiveAdminDatabaseRequestCategory("All");
    setFocusedContactRequestId("");
    setSelectedAdminUserId("");
    setSelectedBulkRequestIds([]);
    setManagementToggleUserId("");
  };

  const handleAdminExport = async (section, format = "csv", searchOverride = null) => {
    try {
      setAdminExportLoading(`${section}-${format}`);
      await downloadAdministrationExport(
        section,
        format,
        section === "requests"
          ? (searchOverride != null ? searchOverride : adminRequestSearch)
          : ""
      );
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
    if (!["administration", "management"].includes(selectedInfoPage || "") || activeInfoTab !== "requests" || !focusedContactRequestId) {
      return;
    }

    const targetCard = document.getElementById(`admin-request-${focusedContactRequestId}`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedInfoPage, activeInfoTab, focusedContactRequestId, adminRequests, activeAdminRequestSection]);

  useEffect(() => {
    if ((selectedInfoPage === "administration" && isAdmin) || (selectedInfoPage === "management" && canAccessManagement)) {
      loadAdministrationData();
    }
  }, [selectedInfoPage, isAdmin, canAccessManagement]);

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
        assignedManagerUserId: requestManagerAssignments[requestId] || null,
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

  const handleManagementAccessToggle = async (userId, nextIsManagement) => {
    const currentManager = managementUsers.find((item) => item.id === userId);
    try {
      setManagementToggleUserId(userId);
      setAdminError("");
      await updateManagementAccess({
        userId,
        isManagement: nextIsManagement,
        suspended: nextIsManagement ? !!currentManager?.accessSuspended : false,
      });
      await loadAdministrationData();
      if (!nextIsManagement) {
        setSelectedAdminUserId("");
      }
    } catch (toggleError) {
      setAdminError(toggleError.message || "Failed to update management access.");
    } finally {
      setManagementToggleUserId("");
    }
  };

  const handleManagementSuspendToggle = async (userId, suspended) => {
    try {
      setManagementToggleUserId(userId);
      setAdminError("");
      await updateManagementAccess({
        userId,
        isManagement: true,
        suspended,
      });
      await loadAdministrationData();
    } catch (toggleError) {
      setAdminError(toggleError.message || "Failed to update management access.");
    } finally {
      setManagementToggleUserId("");
    }
  };

  const handleBulkRequestStatusChange = async (status) => {
    if (selectedBulkRequestIds.length === 0) {
      setAdminError("Select at least one request for a bulk action.");
      return;
    }
    try {
      setAdminError("");
      setAdminActionRequestId("bulk");
      await bulkUpdateManagementRequests({
        requestIds: selectedBulkRequestIds,
        status,
      });
      setSelectedBulkRequestIds([]);
      await loadAdministrationData();
    } catch (bulkError) {
      setAdminError(bulkError.message || "Failed to update the selected requests.");
    } finally {
      setAdminActionRequestId("");
    }
  };

  const handleCreateManagementNote = async ({ requestId = null, targetUserId = null }) => {
    const draftKey = requestId || targetUserId;
    const noteText = (managementNoteDrafts[draftKey] || "").trim();
    if (!noteText) {
      setAdminError("Write a note before saving it.");
      return;
    }
    try {
      setAdminError("");
      await createManagementNote({
        requestId,
        targetUserId,
        noteText,
      });
      setManagementNoteDrafts((current) => ({
        ...current,
        [draftKey]: "",
      }));
      await loadAdministrationData();
    } catch (noteError) {
      setAdminError(noteError.message || "Failed to save management note.");
    }
  };

  const handleCreateReplyTemplate = async () => {
    if (!newTemplateTitle.trim() || !newTemplateBody.trim()) {
      setAdminError("Template title and body are required.");
      return;
    }
    try {
      setAdminError("");
      await createReplyTemplate({
        title: newTemplateTitle,
        category: newTemplateCategory || null,
        body: newTemplateBody,
      });
      setNewTemplateTitle("");
      setNewTemplateCategory("");
      setNewTemplateBody("");
      await loadAdministrationData();
    } catch (templateError) {
      setAdminError(templateError.message || "Failed to create reply template.");
    }
  };

  const handleManagementReportExport = async (format) => {
    try {
      setAdminError("");
      setManagementReportLoading(format);
      await exportManagementReport(format);
    } catch (reportError) {
      setAdminError(reportError.message || "Failed to export management report.");
    } finally {
      setManagementReportLoading("");
    }
  };

  const handleAdminUserStateAction = async (userId, action) => {
    try {
      setAdminError("");
      if (action === "lock") {
        await lockAdminUser(userId, { reason: "Locked from administration center." });
      } else if (action === "reactivate") {
        await reactivateAdminUser(userId, { reason: "Reactivated from administration center." });
      } else if (action === "force-reset") {
        await forceAdminPasswordReset(userId);
      }
      await loadAdministrationData();
    } catch (actionError) {
      setAdminError(actionError.message || "Failed to update the user.");
    }
  };

  const handleAdminAssignRole = async (userId, roleName) => {
    try {
      setAdminError("");
      await assignAdminRole({ userId, roleName });
      await loadAdministrationData();
    } catch (roleError) {
      setAdminError(roleError.message || "Failed to assign role.");
    }
  };

  const handleAdminBillingQuickUpdate = async (transactionId, patch) => {
    try {
      setAdminError("");
      await updateBillingAdministration({ transactionId, ...patch });
      await loadAdministrationData();
    } catch (billingError) {
      setAdminError(billingError.message || "Failed to update billing administration.");
    }
  };

  const handleAdminSaveContent = async () => {
    try {
      setAdminError("");
      await saveAdminContent(adminContentDraft);
      await loadAdministrationData();
    } catch (contentError) {
      setAdminError(contentError.message || "Failed to save content.");
    }
  };

  const handleAdminCreateCommunicationTemplate = async () => {
    try {
      setAdminError("");
      await createAdminCommunicationTemplate(adminCommunicationDraft);
      setAdminCommunicationDraft({
        channel: "email",
        category: "support",
        title: "",
        body: "",
        requiresApproval: false,
      });
      await loadAdministrationData();
    } catch (templateError) {
      setAdminError(templateError.message || "Failed to create communication template.");
    }
  };

  const handleAdminDatabaseQuery = async () => {
    try {
      setAdminError("");
      const result = await runAdminDatabaseQuery({ sql: adminDatabaseQuery });
      setAdminDatabaseQueryResult(result);
    } catch (queryError) {
      setAdminError(queryError.message || "Failed to run the database query.");
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

    if (selectedInfoPage === "administration" || selectedInfoPage === "management") {
      const totalRows = adminTables.reduce((sum, table) => sum + (table.rowCount || 0), 0);
      const userTable = adminTables.find((table) => table.tableName === "users");
      const requestTable = adminTables.find((table) => table.tableName === "contact_requests");
      const statusChoices = adminStatusOptions.length > 0
        ? adminStatusOptions
        : ["In Progress", "In Review", "Completed"];
      const filteredAuditLogs = filteredAdminAuditLogs;
      const accessLabel = selectedInfoPage === "management" ? "management" : "administration";

      if ((selectedInfoPage === "administration" && !isAdmin) || (selectedInfoPage === "management" && !canAccessManagement)) {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-mini-card">
                <h4>{selectedInfoPage === "management" ? "Management access required" : "Admin access required"}</h4>
                <p>
                  {selectedInfoPage === "management"
                    ? "This page is only available for accounts with management privileges."
                    : "This page is only available for accounts with administration privileges."}
                </p>
              </div>
            </article>
          </div>
        );
      }

      if (activeInfoTab === "overview") {
        const overviewCards = selectedInfoPage === "management"
          ? [
              { title: "Management Users", text: String(managementSummary.totalManagementUsers || 0) },
              { title: "Open Requests", text: String(managementSummary.openRequests || 0) },
              { title: "In Review", text: String(managementSummary.inReviewRequests || 0) },
              { title: "Completed Today", text: String(managementSummary.completedToday || 0) },
              { title: "Internal Notes", text: String(managementNotes.length) },
              { title: "Reply Templates", text: String(replyTemplates.length) },
            ]
          : [
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
                    <h4>{selectedInfoPage === "management" ? "Management Snapshot" : "Administration Snapshot"}</h4>
                    <p>
                      {selectedInfoPage === "management"
                        ? "Live request moderation counts and the latest support-facing data."
                        : "Live admin data, renewal watchlist, and the latest audit activity."}
                    </p>
                  </div>
                  {selectedInfoPage === "administration" ? (
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
                  ) : (
                    <div className="admin-toolbar-actions">
                      <button
                        className="admin-table-action-button"
                        type="button"
                        onClick={() => handleManagementReportExport("csv")}
                        disabled={managementReportLoading === "csv"}
                      >
                        {managementReportLoading === "csv" ? "Exporting..." : "Export CSV"}
                      </button>
                      <button
                        className="admin-table-action-button"
                        type="button"
                        onClick={() => handleManagementReportExport("pdf")}
                        disabled={managementReportLoading === "pdf"}
                      >
                        {managementReportLoading === "pdf" ? "Exporting..." : "Export PDF"}
                      </button>
                    </div>
                  )}
                </div>
                {adminLoading ? (
                  <div className="admin-empty-state admin-loading-state">
                    <h4>Loading {accessLabel} data</h4>
                    <p>Fetching requests, moderation details, and the latest workspace snapshots.</p>
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
                        <h4>{selectedInfoPage === "management" ? "Management Activity Dashboard" : "Subscription Renewal Reminders"}</h4>
                        <p>
                          {selectedInfoPage === "management"
                            ? "Handled requests, pending queue, and average response time by management user."
                            : "Members whose premium access expires within the next 14 days."}
                        </p>
                      </div>
                    </div>
                    {selectedInfoPage === "management" ? (
                      <div className="admin-reminder-list">
                        {managementActivityDashboard.map((item) => (
                          <article key={item.managerUserId} className="admin-reminder-card">
                            <div className="admin-reminder-copy">
                              <strong>{item.managerName}</strong>
                              <span>{item.handledRequests} handled | {item.pendingQueue} pending</span>
                            </div>
                            <div className="admin-reminder-meta">
                              <strong>{item.averageResponseMinutes != null ? `${item.averageResponseMinutes} min` : "No replies yet"}</strong>
                              <span>{item.completedToday} completed today</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : adminLoading ? null : adminRenewalReminders.length === 0 ? (
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
                        <h4>{selectedInfoPage === "management" ? "Recent Actions" : "Recent Audit Trail"}</h4>
                        <p>
                          {selectedInfoPage === "management"
                            ? "The latest status updates, replies, removals, notes, and management changes."
                            : "Real backend log entries recorded for admin actions."}
                        </p>
                      </div>
                      {selectedInfoPage === "administration" ? (
                        <input
                        className="auth-input workspace-static-input admin-search-input"
                        type="search"
                        placeholder="Search audit logs"
                        value={adminAuditSearch}
                        onChange={(event) => setAdminAuditSearch(event.target.value)}
                      />
                      ) : null}
                    </div>
                    {selectedInfoPage === "management" ? (
                      <>
                        <select
                          className="auth-input workspace-static-input admin-dropdown-select"
                          value={selectedManagementAction?.id || ""}
                          onChange={(event) => setManagementAuditFocusId(event.target.value)}
                        >
                          <option value="">Pick an action</option>
                          {recentManagementActions.slice(0, 12).map((item) => (
                            <option key={item.id} value={item.id}>
                              {prettifyKey(item.actionType)} | {item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Unknown time"}
                            </option>
                          ))}
                        </select>
                        {selectedManagementAction ? (
                          <article className="admin-audit-card">
                            <div className="admin-audit-card-head">
                              <strong>{prettifyKey(selectedManagementAction.actionType)}</strong>
                              <span>{selectedManagementAction.createdAt ? new Date(selectedManagementAction.createdAt).toLocaleString("en-GB") : "Unknown time"}</span>
                            </div>
                            <p>{selectedManagementAction.detail || "No additional details provided."}</p>
                            <div className="admin-audit-meta">
                              <span>{selectedManagementAction.actorName || selectedManagementAction.actorEmail || "Unknown user"}</span>
                              <span>{prettifyKey(selectedManagementAction.targetType)}: {selectedManagementAction.targetLabel || selectedManagementAction.targetId || "Not available"}</span>
                            </div>
                          </article>
                        ) : null}
                      </>
                    ) : adminLoading ? null : filteredAuditLogs.length === 0 ? (
                      <div className="admin-empty-state">
                        <h4>No audit entries found</h4>
                        <p>Admin actions will appear here after moderation or export events are recorded.</p>
                      </div>
                    ) : (
                      <>
                        <select
                          className="auth-input workspace-static-input admin-dropdown-select"
                          value={selectedAdminAuditLog?.id || ""}
                          onChange={(event) => setAdminAuditFocusId(event.target.value)}
                        >
                          <option value="">Pick an audit entry</option>
                          {filteredAuditLogs.slice(0, 20).map((item) => (
                            <option key={item.id} value={item.id}>
                              {prettifyKey(item.actionType)} | {item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Unknown time"}
                            </option>
                          ))}
                        </select>
                        {selectedAdminAuditLog ? (
                          <article className="admin-audit-card">
                            <div className="admin-audit-card-head">
                              <strong>{prettifyKey(selectedAdminAuditLog.actionType)}</strong>
                              <span>{selectedAdminAuditLog.createdAt ? new Date(selectedAdminAuditLog.createdAt).toLocaleString("en-GB") : "Unknown time"}</span>
                            </div>
                            <p>{selectedAdminAuditLog.detail || "No additional details provided."}</p>
                            <div className="admin-audit-meta">
                              <span>{selectedAdminAuditLog.adminName || selectedAdminAuditLog.adminEmail || "Unknown admin"}</span>
                              <span>{prettifyKey(selectedAdminAuditLog.targetType)}: {selectedAdminAuditLog.targetLabel || selectedAdminAuditLog.targetId || "Not available"}</span>
                            </div>
                          </article>
                        ) : null}
                      </>
                    )}
                  </section>
                </div>
                {selectedInfoPage === "management" ? (
                  <div className="admin-overview-grid">
                    <section className="workspace-mini-card admin-overview-panel">
                      <div className="admin-section-header">
                        <div>
                          <h4>Reply Templates</h4>
                          <p>Quick canned responses for common support and request cases.</p>
                        </div>
                      </div>
                      <div className="admin-audit-list">
                        {replyTemplates.slice(0, 6).map((item) => (
                          <article key={item.id} className="admin-audit-card">
                            <div className="admin-audit-card-head">
                              <strong>{item.title}</strong>
                              <span>{prettifyKey(item.category || "general")}</span>
                            </div>
                            <p>{item.body}</p>
                          </article>
                        ))}
                      </div>
                      {isAdmin ? (
                        <div className="workspace-form-stack">
                          <input
                            className="auth-input workspace-static-input"
                            type="text"
                            placeholder="Template title"
                            value={newTemplateTitle}
                            onChange={(event) => setNewTemplateTitle(event.target.value)}
                          />
                          <input
                            className="auth-input workspace-static-input"
                            type="text"
                            placeholder="Category like general or technical"
                            value={newTemplateCategory}
                            onChange={(event) => setNewTemplateCategory(event.target.value)}
                          />
                          <textarea
                            className="question-input workspace-static-textarea"
                            rows={3}
                            placeholder="Template body"
                            value={newTemplateBody}
                            onChange={(event) => setNewTemplateBody(event.target.value)}
                          />
                          <button className="admin-table-action-button" type="button" onClick={handleCreateReplyTemplate}>
                            Save Template
                          </button>
                        </div>
                      ) : null}
                    </section>

                    <section className="workspace-mini-card admin-overview-panel">
                      <div className="admin-section-header">
                        <div>
                          <h4>Manager Notes</h4>
                          <p>Internal notes visible only to admin and management accounts.</p>
                        </div>
                      </div>
                      <div className="admin-audit-list">
                        {managementNotes.slice(0, 6).map((item) => (
                          <article key={item.id} className="admin-audit-card">
                            <div className="admin-audit-card-head">
                              <strong>{item.authorName || "Unknown user"}</strong>
                              <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Unknown time"}</span>
                            </div>
                            <p>{item.noteText}</p>
                            <div className="admin-audit-meta">
                              <span>Request: {item.requestId || "Not linked"}</span>
                              <span>User: {item.targetUserId || "Not linked"}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>
                ) : null}
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
                <div className="admin-toolbar admin-toolbar-right">
                  <div className="admin-toolbar-actions">
                    <input
                      className="auth-input workspace-static-input admin-search-input admin-square-input"
                      type="search"
                      placeholder="Search requests, users, email, title"
                      value={adminRequestSearch}
                      onChange={(event) => setAdminRequestSearch(event.target.value)}
                    />
                    <button
                      className="admin-table-action-button"
                      type="button"
                      onClick={() => handleBulkRequestStatusChange("In Review")}
                      disabled={adminActionRequestId === "bulk"}
                    >
                      {adminActionRequestId === "bulk" ? "Updating..." : "Bulk In Review"}
                    </button>
                    <button
                      className="admin-table-action-button"
                      type="button"
                      onClick={() => handleBulkRequestStatusChange("Completed")}
                      disabled={adminActionRequestId === "bulk"}
                    >
                      {adminActionRequestId === "bulk" ? "Updating..." : "Bulk Completed"}
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
                          onClick={() => {
                            setActiveAdminRequestSection(section.id);
                            setFocusedContactRequestId("");
                            setAdminRequestSearch("");
                          }}
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
                                onClick={() => {
                                  if (focusedContactRequestId === requestItem.id) {
                                    setFocusedContactRequestId("");
                                    return;
                                  }
                                  setFocusedContactRequestId(requestItem.id);
                                }}
                              >
                                <div className="admin-request-card-header">
                                  <div>
                                    <input
                                      type="checkbox"
                                      checked={selectedBulkRequestIds.includes(requestItem.id)}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) => {
                                        setSelectedBulkRequestIds((current) =>
                                          event.target.checked
                                            ? [...current, requestItem.id]
                                            : current.filter((item) => item !== requestItem.id)
                                        );
                                      }}
                                    />
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
                                  <div className="contact-request-meta-item">
                                    <span>Assigned</span>
                                    <strong>{requestItem.assignedManagerName || "Unassigned"}</strong>
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
                                  <select
                                    className="auth-input workspace-static-input"
                                    value={requestManagerAssignments[requestItem.id] || ""}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      setRequestManagerAssignments((current) => ({
                                        ...current,
                                        [requestItem.id]: event.target.value,
                                      }))
                                    }
                                    disabled={adminActionRequestId === requestItem.id}
                                  >
                                    <option value="">Unassigned</option>
                                    {managementEligibleUsers.filter((item) => !item.accessSuspended).map((manager) => (
                                      <option key={manager.id} value={manager.id}>
                                        {manager.fullName} | {manager.email}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="admin-request-action-row">
                                    <select
                                      className="auth-input workspace-static-input"
                                      value={requestTemplateSelections[requestItem.id] || ""}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) =>
                                        setRequestTemplateSelections((current) => ({
                                          ...current,
                                          [requestItem.id]: event.target.value,
                                        }))
                                      }
                                    >
                                      <option value="">Reply template</option>
                                      {replyTemplates
                                        .filter((item) => !item.category || item.category === requestItem.category)
                                        .map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.title}
                                          </option>
                                        ))}
                                    </select>
                                    <button
                                      className="admin-table-action-button"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        const template = replyTemplates.find((item) => item.id === requestTemplateSelections[requestItem.id]);
                                        if (!template) return;
                                        setAdminReplyDrafts((current) => ({
                                          ...current,
                                          [requestItem.id]: template.body,
                                        }));
                                      }}
                                    >
                                      Apply Template
                                    </button>
                                  </div>
                                  <textarea
                                    className="question-input workspace-static-textarea"
                                    rows={4}
                                    placeholder="Write the message that the user should see with this status update."
                                    value={adminReplyDrafts[requestItem.id] || ""}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      setAdminReplyDrafts((current) => ({
                                        ...current,
                                        [requestItem.id]: event.target.value,
                                      }))
                                    }
                                    disabled={adminActionRequestId === requestItem.id}
                                  />
                                  <textarea
                                    className="question-input workspace-static-textarea"
                                    rows={3}
                                    placeholder="Manager note visible only to admin and management"
                                    value={managementNoteDrafts[requestItem.id] || ""}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      setManagementNoteDrafts((current) => ({
                                        ...current,
                                        [requestItem.id]: event.target.value,
                                      }))
                                    }
                                  />
                                  <div className="admin-request-action-row">
                                    <select
                                      className="auth-input workspace-static-input admin-request-status-select"
                                      value={requestItem.status || statusChoices[0]}
                                      onClick={(event) => event.stopPropagation()}
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
                                      className="admin-table-action-button"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleCreateManagementNote({ requestId: requestItem.id, targetUserId: requestItem.userId });
                                      }}
                                    >
                                      Save Note
                                    </button>
                                    <button
                                      className="primary-button"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleAdminDelete(requestItem.id);
                                      }}
                                      disabled={adminActionRequestId === requestItem.id}
                                    >
                                      {adminActionRequestId === requestItem.id ? "Working..." : "Delete Request"}
                                    </button>
                                    <button
                                      className="primary-button"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleAdminExport("requests", "csv", requestItem.requestCode || requestItem.id || "");
                                      }}
                                      disabled={adminExportLoading === "requests-csv"}
                                    >
                                      {adminExportLoading === "requests-csv" ? "Exporting..." : "Export Request"}
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
        const categoryFilters = getAdminSupportCategoryFilters();
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
                <p className="tool-copy">Browse support requests with status and category filters in one dedicated management section.</p>
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
                          onClick={() =>
                            setActiveAdminDatabaseRequestFilter((current) =>
                              current === filter.id ? "All" : filter.id
                            )
                          }
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
                        rowsForStatus.filter(
                          (row) => (row.category || "").toLowerCase() === filter.id
                        ).length;

                      return (
                        <button
                          key={filter.id}
                          type="button"
                          className={`contact-request-category-button ${activeAdminDatabaseRequestCategory === filter.id ? "active" : ""}`}
                          onClick={() =>
                            setActiveAdminDatabaseRequestCategory((current) =>
                              current === filter.id ? "All" : filter.id
                            )
                          }
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

      if (selectedInfoPage === "administration" && activeInfoTab === "users") {
        return (
          <>
            <div className="insight-section">
              <div className="insight-card">
                <h3 className="tool-title">{activeInfoContent.heading}</h3>
                <p className="tool-copy">Edit users, verify contact fields, lock or reactivate accounts, require password reset, and inspect each user timeline.</p>
              </div>
            </div>
            <div className="content-grid single-column">
              <article className="tool-card workspace-copy-card">
                <div className="admin-toolbar">
                  <div className="admin-toolbar-copy">
                    <h4>Users</h4>
                    <p>Search the full user base, including admin and management accounts.</p>
                  </div>
                  <div className="admin-toolbar-actions">
                    <input
                      className="auth-input workspace-static-input admin-search-input"
                      type="search"
                      placeholder="Search users"
                      value={adminUserSearch}
                      onChange={(event) => setAdminUserSearch(event.target.value)}
                    />
                  </div>
                </div>
                <div className="admin-request-grid">
                  {filteredAdminCenterUsers.map((user) => (
                    <article key={user.id} className="admin-request-card">
                      <div className="admin-request-card-header">
                        <div>
                          <p className="contact-request-type">{(user.roles || []).join(", ") || "No roles"}</p>
                          <h4>{user.fullName}</h4>
                        </div>
                        <span className={`contact-request-status-chip status-${user.accountLocked ? "completed" : "in-review"}`}>
                          {user.accountLocked ? "Locked" : "Active"}
                        </span>
                      </div>
                      <div className="admin-request-meta-grid">
                        <div className="contact-request-meta-item"><span>Email</span><strong>{user.email}</strong></div>
                        <div className="contact-request-meta-item"><span>Mobile</span><strong>{user.mobile}</strong></div>
                        <div className="contact-request-meta-item"><span>Last Login</span><strong>{user.lastLoginAt || "Not available"}</strong></div>
                      </div>
                      <div className="admin-request-action-row">
                        <button className="admin-table-action-button" type="button" onClick={() => handleAdminUserStateAction(user.id, user.accountLocked ? "reactivate" : "lock")}>
                          {user.accountLocked ? "Reactivate" : "Lock"}
                        </button>
                        <button className="admin-table-action-button" type="button" onClick={() => handleAdminUserStateAction(user.id, "force-reset")}>
                          Force Password Reset
                        </button>
                        <button className="admin-table-action-button" type="button" onClick={() => handleAdminAssignRole(user.id, "support")}>
                          Give Support
                        </button>
                      </div>
                      <div className="admin-user-history-list">
                        {(user.timeline || []).slice(0, 5).map((item, index) => (
                          <div key={`${user.id}-${index}`} className="admin-user-history-item">
                            <strong>{item.title}</strong>
                            <p>{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
                {filteredAdminCenterUsers.length === 0 ? (
                  <div className="admin-empty-state">
                    <h4>No users matched the current search</h4>
                    <p>Try a different name, email, role, or mobile number.</p>
                  </div>
                ) : null}
              </article>
            </div>
          </>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "roles") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                {adminRolesPanel.roles.map((role) => (
                  <div key={role.id} className="workspace-mini-card">
                    <h4>{role.name}</h4>
                    <p>{role.description || "No description"}</p>
                    <p>{(role.permissions || []).join(", ") || "No permissions"}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "sla") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                <div className="workspace-mini-card"><h4>First Response Avg</h4><p>{adminSlaPanel.firstResponseAverageMinutes ?? "N/A"} min</p></div>
                <div className="workspace-mini-card"><h4>Overdue Queue</h4><p>{(adminSlaPanel.overdueQueue || []).length}</p></div>
                <div className="workspace-mini-card"><h4>Breached Queue</h4><p>{(adminSlaPanel.breachedQueue || []).length}</p></div>
                <div className="workspace-mini-card"><h4>Escalations</h4><p>{adminSlaPanel.escalations || 0}</p></div>
              </div>
              <div className="admin-audit-list">
                {(adminSlaPanel.agingBuckets || []).map((item) => (
                  <article key={item.bucket} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{item.bucket}</strong><span>{item.count}</span></div>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "assignments") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                {(adminAssignmentsPanel.managerLoad || []).map((item) => (
                  <div key={item.managerUserId} className="workspace-mini-card">
                    <h4>{item.managerName}</h4>
                    <p>{item.assignedCount} assigned | {item.inReviewCount} in review | {item.technicalCount} technical</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "analytics") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                <div className="workspace-mini-card"><h4>Daily Requests</h4><p>{adminAnalyticsPanel.dailyRequests || 0}</p></div>
                <div className="workspace-mini-card"><h4>Weekly Requests</h4><p>{adminAnalyticsPanel.weeklyRequests || 0}</p></div>
                <div className="workspace-mini-card"><h4>Monthly Requests</h4><p>{adminAnalyticsPanel.monthlyRequests || 0}</p></div>
                <div className="workspace-mini-card"><h4>Premium Users</h4><p>{adminAnalyticsPanel.subscriptionConversions?.premiumUsers || 0}</p></div>
              </div>
              <div className="admin-audit-list">
                {(adminAnalyticsPanel.categoryHeatmap || []).map((item) => (
                  <article key={item.category} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{item.category}</strong><span>{item.count}</span></div>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "billing") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="admin-request-grid">
                {(adminBillingPanel.transactions || []).slice(0, 20).map((item) => (
                  <article key={item.id} className="admin-request-card">
                    <div className="admin-request-card-header">
                      <div><p className="contact-request-type">{item.invoiceNumber}</p><h4>{item.planName}</h4></div>
                      <span className="contact-request-status-chip status-in-review">{item.status}</span>
                    </div>
                    <p>{item.customerName}</p>
                    <p>Refund: {item.refundStatus || "none"} | Dispute: {item.disputeStatus || "none"} | Retries: {item.retryCount || 0}</p>
                    <div className="admin-request-action-row">
                      <button className="admin-table-action-button" type="button" onClick={() => handleAdminBillingQuickUpdate(item.id, { refundStatus: "review" })}>Mark Refund Review</button>
                      <button className="admin-table-action-button" type="button" onClick={() => handleAdminBillingQuickUpdate(item.id, { retryCount: (item.retryCount || 0) + 1 })}>Retry +1</button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "communications") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-form-stack">
                <input className="auth-input workspace-static-input" type="text" placeholder="Title" value={adminCommunicationDraft.title} onChange={(event) => setAdminCommunicationDraft((current) => ({ ...current, title: event.target.value }))} />
                <textarea className="question-input workspace-static-textarea" rows={3} placeholder="Body" value={adminCommunicationDraft.body} onChange={(event) => setAdminCommunicationDraft((current) => ({ ...current, body: event.target.value }))} />
                <button className="admin-table-action-button" type="button" onClick={handleAdminCreateCommunicationTemplate}>Create Template</button>
              </div>
              <div className="admin-audit-list">
                {(adminCommunicationsPanel.templates || []).slice(0, 12).map((item) => (
                  <article key={item.id} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{item.title}</strong><span>{item.channel}</span></div>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "compliance") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                <div className="workspace-mini-card"><h4>Immutable Audit Trail</h4><p>{(adminCompliancePanel.auditLogs || []).length} entries</p></div>
                <div className="workspace-mini-card"><h4>Signed Reports</h4><p>{adminCompliancePanel.signedReportReady ? "Ready" : "Not ready"}</p></div>
                <div className="workspace-mini-card"><h4>Retention Policy</h4><p>{adminCompliancePanel.retentionPolicyDays || 0} days</p></div>
              </div>
              <div className="admin-audit-list">
                {(adminCompliancePanel.auditLogs || []).slice(0, 15).map((item) => (
                  <article key={item.id} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{prettifyKey(item.actionType)}</strong><span>{item.createdAt || "Unknown time"}</span></div>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "operations") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                <div className="workspace-mini-card"><h4>App Health</h4><p>{adminOperationsPanel.appHealth || "Unknown"}</p></div>
                <div className="workspace-mini-card"><h4>Pending Queue</h4><p>{adminOperationsPanel.queueStatus?.pendingRequests || 0}</p></div>
                <div className="workspace-mini-card"><h4>Document Files</h4><p>{adminOperationsPanel.storageUsage?.documentFiles || 0}</p></div>
                <div className="workspace-mini-card"><h4>Webhook Failures</h4><p>{adminOperationsPanel.webhookFailures || 0}</p></div>
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "content") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-form-stack">
                <input className="auth-input workspace-static-input" type="text" placeholder="Page key" value={adminContentDraft.pageKey} onChange={(event) => setAdminContentDraft((current) => ({ ...current, pageKey: event.target.value }))} />
                <input className="auth-input workspace-static-input" type="text" placeholder="Section key" value={adminContentDraft.sectionKey} onChange={(event) => setAdminContentDraft((current) => ({ ...current, sectionKey: event.target.value }))} />
                <input className="auth-input workspace-static-input" type="text" placeholder="Title" value={adminContentDraft.title} onChange={(event) => setAdminContentDraft((current) => ({ ...current, title: event.target.value }))} />
                <textarea className="question-input workspace-static-textarea" rows={4} placeholder="JSON body" value={adminContentDraft.bodyJson} onChange={(event) => setAdminContentDraft((current) => ({ ...current, bodyJson: event.target.value }))} />
                <button className="admin-table-action-button" type="button" onClick={handleAdminSaveContent}>Save Content</button>
              </div>
              <div className="admin-audit-list">
                {(adminContentPanel.entries || []).slice(0, 20).map((item) => (
                  <article key={item.id} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{item.pageKey}:{item.sectionKey}</strong><span>{item.updatedAt || "Unknown time"}</span></div>
                    <p>{item.title}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "security") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                <div className="workspace-mini-card"><h4>Locked Users</h4><p>{adminSecurityPanel.lockedUsers || 0}</p></div>
                <div className="workspace-mini-card"><h4>2FA Required Admins</h4><p>{adminSecurityPanel.twoFactorRequiredAdmins || 0}</p></div>
                <div className="workspace-mini-card"><h4>Flagged Requests</h4><p>{adminSecurityPanel.flaggedRequests || 0}</p></div>
              </div>
              <div className="admin-audit-list">
                {(adminSecurityPanel.securityEvents || []).slice(0, 15).map((item) => (
                  <article key={item.id} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{prettifyKey(item.eventType)}</strong><span>{item.severity}</span></div>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "automation") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="admin-audit-list">
                {(adminAutomationPanel.rules || []).map((item) => (
                  <article key={item.id} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{item.name}</strong><span>{item.triggerKey}</span></div>
                    <p>Conditions: {item.conditionsJson}</p>
                    <p>Actions: {item.actionsJson}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "notifications") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-mini-card"><h4>Unread Notifications</h4><p>{adminNotificationsPanel.unreadCount || 0}</p></div>
              <div className="admin-audit-list">
                {(adminNotificationsPanel.items || []).map((item) => (
                  <article key={item.id} className="admin-audit-card">
                    <div className="admin-audit-card-head"><strong>{item.title}</strong><span>{item.level}</span></div>
                    <p>{item.message}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (selectedInfoPage === "administration" && activeInfoTab === "reports") {
        return (
          <div className="content-grid single-column">
            <article className="tool-card workspace-copy-card">
              <div className="workspace-info-grid">
                {(adminReportsPanel.presets || []).map((item) => (
                  <div key={item.id} className="workspace-mini-card">
                    <h4>{item.name}</h4>
                    <p>{item.outputFormat}</p>
                    <p>{item.filtersJson}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        );
      }

      if (activeInfoTab === "users" && selectedInfoPage === "management") {
        const requestTable = adminTables.find((table) => table.tableName === "users");
        const tableRows = (requestTable?.rows || []).filter((row) => !row.is_admin && !row.is_management);
        const filteredRows = tableRows.filter((row) =>
          matchesAdminSearch(
            {
              publicUserCode: row.public_user_code,
              fullName: row.full_name,
              username: row.username,
              email: row.email,
              mobile: row.mobile,
              subscriptionPlanName: row.subscription_plan_name,
            },
            managementUserSearch
          )
        );
        const tableColumns = [
          "public_user_code",
          "full_name",
          "username",
          "email",
          "mobile",
          "created_at",
          "__management_actions__",
        ];

        return (
          <>
            <div className="insight-section">
              <div className="insight-card">
                <h3 className="tool-title">{activeInfoContent.heading}</h3>
                <p className="tool-copy">Search all regular members. Admin and management accounts are hidden from this view.</p>
              </div>
            </div>
            <div className="content-grid single-column">
              <article className="tool-card workspace-copy-card">
                <div className="admin-toolbar">
                  <div className="admin-toolbar-copy">
                    <h4>Member Directory</h4>
                    <p>Use the search box to find users by name, email, username, or member code.</p>
                  </div>
                  <div className="admin-toolbar-actions">
                    <input
                      className="auth-input workspace-static-input admin-search-input"
                      type="search"
                      placeholder="Search members"
                      value={managementUserSearch}
                      onChange={(event) => setManagementUserSearch(event.target.value)}
                    />
                  </div>
                </div>
                <section className="admin-table-section">
                  <div className="admin-table-header">
                    <div>
                      <h4>Users</h4>
                      <p>{filteredRows.length} rows</p>
                    </div>
                  </div>
                  <div className="admin-table-scroll">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          {tableColumns.map((columnName) => (
                            <th key={columnName}>
                              <span>{columnName === "__management_actions__" ? "Action" : prettifyKey(columnName)}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length > 0 ? (
                          filteredRows.map((row, index) => (
                            <tr key={`management-member-${index}`}>
                              {tableColumns.map((columnName) => (
                                <td key={`management-member-${index}-${columnName}`}>
                                  {columnName === "__management_actions__" ? (
                                    <div className="admin-table-action-group">
                                      <button
                                        type="button"
                                        className="admin-table-action-button"
                                        onClick={() => setSelectedAdminUserId(row.id)}
                                      >
                                        View Profile
                                      </button>
                                    </div>
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
                              No members matched the current search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </article>
            </div>
          </>
        );
      }

      if (activeInfoTab === "management" && selectedInfoPage === "administration") {
        const tableColumns = [
          "publicUserCode",
          "fullName",
          "username",
          "email",
          "requestCount",
          "accessStatus",
          "managementGrantedAt",
          "__management_actions__",
        ];

        return (
          <>
            <div className="insight-section">
              <div className="insight-card">
                <h3 className="tool-title">{activeInfoContent.heading}</h3>
                <p className="tool-copy">Search management users, review access dates, suspend access, open handled request history, and track workload.</p>
              </div>
            </div>
            <div className="content-grid single-column">
              <article className="tool-card workspace-copy-card">
                <div className="workspace-info-grid">
                  <div className="workspace-mini-card">
                    <h4>Total Management Users</h4>
                    <p>{managementSummary.totalManagementUsers || 0}</p>
                  </div>
                  <div className="workspace-mini-card">
                    <h4>Open Requests</h4>
                    <p>{managementSummary.openRequests || 0}</p>
                  </div>
                  <div className="workspace-mini-card">
                    <h4>In Review Requests</h4>
                    <p>{managementSummary.inReviewRequests || 0}</p>
                  </div>
                  <div className="workspace-mini-card">
                    <h4>Completed Today</h4>
                    <p>{managementSummary.completedToday || 0}</p>
                  </div>
                </div>
                <div className="admin-toolbar">
                  <div className="admin-toolbar-copy">
                    <h4>Management User List</h4>
                    <p>Filter by name, email, request count, and active or suspended access.</p>
                  </div>
                  <div className="admin-toolbar-actions">
                    <input
                      className="auth-input workspace-static-input admin-search-input"
                      type="search"
                      placeholder="Search management users"
                      value={managementUserSearch}
                      onChange={(event) => setManagementUserSearch(event.target.value)}
                    />
                    <select
                      className="auth-input workspace-static-input"
                      value={managementAccessFilter}
                      onChange={(event) => setManagementAccessFilter(event.target.value)}
                    >
                      <option value="all">All Access</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <select
                      className="auth-input workspace-static-input"
                      value={managementRequestCountFilter}
                      onChange={(event) => setManagementRequestCountFilter(event.target.value)}
                    >
                      <option value="all">All Request Counts</option>
                      <option value="assigned">Assigned Requests</option>
                      <option value="idle">No Requests</option>
                    </select>
                  </div>
                </div>
                <section className="admin-table-section">
                  <div className="admin-table-header">
                    <div>
                      <h4>Users</h4>
                      <p>{filteredManagementUsers.length} rows</p>
                    </div>
                  </div>
                  <div className="admin-table-scroll">
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          {tableColumns.map((columnName) => (
                            <th key={columnName}>
                              <span>
                                {columnName === "__management_actions__"
                                  ? "Action"
                                    : prettifyKey(columnName)}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredManagementUsers.length > 0 ? (
                          filteredManagementUsers.map((row, index) => (
                            <tr key={`management-user-${index}`}>
                              {tableColumns.map((columnName) => (
                                <td key={`management-user-${index}-${columnName}`}>
                                  {columnName === "__management_actions__" ? (
                                    <div className="admin-table-action-group">
                                      <button
                                        type="button"
                                        className="admin-table-action-button"
                                        onClick={() => setSelectedAdminUserId(row.id)}
                                      >
                                        View Profile
                                      </button>
                                      {isAdmin ? (
                                        <>
                                          <button
                                            type="button"
                                            className="admin-table-action-button"
                                            onClick={() => handleManagementSuspendToggle(row.id, !row.accessSuspended)}
                                            disabled={managementToggleUserId === row.id}
                                          >
                                            {managementToggleUserId === row.id
                                              ? "Updating..."
                                              : row.accessSuspended
                                                ? "Resume"
                                                : "Suspend"}
                                          </button>
                                          <button
                                            type="button"
                                            className="admin-table-action-button danger-tone"
                                            onClick={() => handleManagementAccessToggle(row.id, false)}
                                            disabled={managementToggleUserId === row.id}
                                          >
                                            {managementToggleUserId === row.id ? "Removing..." : "Remove"}
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                  ) : (
                                    renderDatabaseCell(
                                      columnName,
                                      columnName === "accessStatus"
                                        ? row.accessSuspended ? "Suspended" : "Active"
                                        : row[columnName]
                                    )
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={tableColumns.length} className="admin-table-empty-row">
                              No management users matched the current search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
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
                    <p>Review live table snapshots, search within the current section, export data, and run read-only admin queries.</p>
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
                {selectedInfoPage === "administration" ? (
                  <div className="workspace-form-stack">
                    <textarea
                      className="question-input workspace-static-textarea"
                      rows={3}
                      value={adminDatabaseQuery}
                      onChange={(event) => setAdminDatabaseQuery(event.target.value)}
                    />
                    <button className="admin-table-action-button" type="button" onClick={handleAdminDatabaseQuery}>
                      Run Read-Only Query
                    </button>
                    <p className="tool-copy">Mode: {adminDatabaseToolsPanel.queryMode || "read-only"} | Known tables: {adminDatabaseToolsPanel.tableCount || 0}</p>
                    {adminDatabaseQueryResult ? (
                      <p className="tool-copy">Rows returned: {adminDatabaseQueryResult.rowCount || 0}</p>
                    ) : null}
                  </div>
                ) : null}
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
        { title: "Management Access", text: selectedAdminUserDetails.userRow.is_management ? "Enabled" : "Disabled" },
        { title: "Access Status", text: selectedAdminUserDetails.managementMeta?.accessSuspended ? "Suspended" : "Active" },
        { title: "Granted On", text: selectedAdminUserDetails.managementMeta?.managementGrantedAt || "Not available" },
        { title: "Granted By", text: selectedAdminUserDetails.managementMeta?.managementGrantedByName || "Not available" },
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
                    onClick={() => {
                      if (selectedInfoPage === "administration" || selectedInfoPage === "management") {
                        resetAdministrationPanelState();
                      }
                      setInfoTabs((current) => ({
                        ...current,
                        [selectedInfoPage]: tab.id,
                      }));
                    }}
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

              {isAdmin && selectedAdminUserDetails.userRow.id !== currentUser?.id && !(selectedInfoPage === "administration" && activeInfoTab === "management") ? (
                <div className="admin-toolbar">
                  <div className="admin-toolbar-copy">
                    <h4>Management Permission</h4>
                    <p>Use this control to decide whether this user can open the management workspace.</p>
                  </div>
                  <div className="admin-toolbar-actions">
                    <button
                      type="button"
                      className="admin-table-action-button"
                      onClick={() =>
                        handleManagementAccessToggle(
                          selectedAdminUserDetails.userRow.id,
                          !selectedAdminUserDetails.userRow.is_management
                        )
                      }
                      disabled={managementToggleUserId === selectedAdminUserDetails.userRow.id}
                    >
                      {managementToggleUserId === selectedAdminUserDetails.userRow.id
                        ? "Updating..."
                        : selectedAdminUserDetails.userRow.is_management
                          ? "Remove Management"
                          : "Give Management"}
                    </button>
                    {selectedAdminUserDetails.userRow.is_management ? (
                      <button
                        type="button"
                        className="admin-table-action-button"
                        onClick={() =>
                          handleManagementSuspendToggle(
                            selectedAdminUserDetails.userRow.id,
                            !selectedAdminUserDetails.managementMeta?.accessSuspended
                          )
                        }
                        disabled={managementToggleUserId === selectedAdminUserDetails.userRow.id}
                      >
                        {selectedAdminUserDetails.managementMeta?.accessSuspended ? "Resume Access" : "Suspend Access"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

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

              {selectedAdminUserDetails.handledRequests.length > 0 ? (
                <div className="admin-user-history-panel">
                  <h4>Handled Request History</h4>
                  <div className="admin-user-history-list">
                    {selectedAdminUserDetails.handledRequests.map((item) => (
                      <div key={item.id} className="admin-user-history-item">
                        <strong>{item.requestCode || item.title || item.id}</strong>
                        <p>{item.status} | {item.userFullName || item.userEmail || "Unknown user"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="admin-toolbar">
                <div className="admin-toolbar-copy">
                  <h4>Internal Manager Note</h4>
                  <p>Add a note that only administration and management users can see.</p>
                </div>
                <div className="admin-toolbar-actions" />
              </div>
              <div className="workspace-form-stack">
                <textarea
                  className="question-input workspace-static-textarea"
                  rows={3}
                  placeholder="Write an internal note for this user"
                  value={managementNoteDrafts[selectedAdminUserDetails.userRow.id] || ""}
                  onChange={(event) =>
                    setManagementNoteDrafts((current) => ({
                      ...current,
                      [selectedAdminUserDetails.userRow.id]: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="admin-table-action-button"
                  onClick={() => handleCreateManagementNote({ targetUserId: selectedAdminUserDetails.userRow.id })}
                >
                  Save User Note
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default WorkspacePage;
