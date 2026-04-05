import React, { useEffect, useMemo, useState } from "react";

import DocumentRetrievalPanel from "../document-retrieval/DocumentRetrievalPanel";
import ImageGenerationPanel from "../image-generation/ImageGenerationPanel";
import ObjectDetectionPanel from "../object-detection/ObjectDetectionPanel";
import SettingsPanel from "./SettingsPanel";
import {
  createContactRequest,
  deleteContactRequest,
  listContactRequests,
} from "../info/contactApi";
import { requestJson } from "../../shared/api/http";
import { getSessionId } from "../../shared/session/session";

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
      { id: "technical", label: "Technical Support", heading: "Technical", form: ["Full Name", "Email", "Ticket ID", "Platform (Web/App)", "Issue Type"], textarea: "Issue Description", button: "Submit Ticket" },
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
    message: "All pricing plans are billed in USD. Cancel anytime. Features and access may vary depending on your region and compliance requirements.",
    statusTitle: "Need Help?",
    statusItems: ["support@yourcompany.com", "+91 98765 43210"],
    tabs: [
      {
        id: "individual",
        label: "Individual",
        heading: "Individual Plans",
        cards: [
          { title: "Free Plan", text: "$0 / month\nFor basic personal use with limited features.\n1 user account, Basic tools only, Community forum access, 1GB storage\nNote: Does not include customer support or export tools." },
          { title: "Pro Plan", text: "$9 / month\nIdeal for individuals with moderate needs.\nUp to 3 devices, 10GB cloud backup, Email support, Data export options\nNote: Includes 7-day free trial. Cancel anytime." },
        ],
      },
      {
        id: "business",
        label: "Business",
        heading: "Business Plans",
        cards: [
          { title: "Startup", text: "$29 / month\nBest for small teams and collaborative work.\nUp to 5 users, Collaboration dashboard, Team analytics, Chat & email support\nNote: Free onboarding included." },
          { title: "Growth", text: "$59 / month\nAdvanced tools for expanding businesses.\nUnlimited team members, Custom reporting tools, 24/7 support, Third-party integrations\nNote: Save 15% with annual plan." },
        ],
      },
      {
        id: "enterprise",
        label: "Enterprise",
        heading: "Enterprise Plans",
        cards: [
          { title: "Enterprise", text: "Custom Pricing\nTailored for large organizations with advanced needs.\nCustom SLA, Dedicated account manager, Role-based access control, On-premise options\nNote: Contact sales for a custom quote." },
        ],
      },
      {
        id: "developer",
        label: "Developer",
        heading: "Developer Plans",
        cards: [
          { title: "Developer Access", text: "$19 / month\nTools and APIs for developer integration.\nAPI sandbox, Unlimited calls, Webhook support, Private dev Slack\nNote: Great for testing and prototyping." },
        ],
      },
      {
        id: "education",
        label: "Education",
        heading: "Education Plans",
        cards: [
          { title: "Student Plan", text: "Free\nAccess to Pro tools for students.\nAll Pro features, 2 devices allowed, Extended trial\nNote: Valid .edu or school email required." },
        ],
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
    statusItems: ["Account", "Security", "Preferences", "Privacy", "Activity", "Billing"],
    tabs: [
      { id: "account", label: "Account", heading: "Account" },
      { id: "security", label: "Security", heading: "Security" },
      { id: "preferences", label: "Preferences", heading: "Preferences" },
      { id: "privacy", label: "Privacy", heading: "Privacy" },
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
};

function WorkspacePage({ currentUser, selectedInfoPage = null, onUserUpdate }) {
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
  const profileJoined = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not available";
  const activeContactStatus = contactStatus[activeInfoTab] || { type: "", text: "" };
  const contactCategoryOrder = ["general", "business", "feedback", "technical", "partnership", "media"];

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

  useEffect(() => {
    if (selectedInfoPage === "contact" && currentUser?.id) {
      loadContactRequests();
    }
  }, [selectedInfoPage, currentUser?.id]);

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

  const renderInfoContent = () => {
    if (!activeInfoContent) return null;

    if (selectedInfoPage === "profile") {
      const profileCards =
        activeInfoTab === "overview"
          ? [
              { title: "Full Name", text: profileName },
              { title: "Account Email", text: profileEmail },
              { title: "Plan", text: "Pro Member" },
              { title: "Workspace Role", text: "Account Owner" },
              { title: "Status", text: "Active" },
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
                  { title: "Current Plan", text: "Pro - Rs999/month" },
                  { title: "Billing Cycle", text: "Monthly" },
                  { title: "Next Renewal", text: "04 May 2026" },
                  { title: "Payment Method", text: "Visa ending in 4242" },
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
              <SettingsPanel activeTab={activeInfoTab} currentUser={currentUser} onUserUpdate={onUserUpdate} />
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
                        <div className="contact-request-panel-head">
                          <div>
                            <p className="contact-request-panel-kicker">Request Category</p>
                            <h4>{selectedSubmittedGroup.label}</h4>
                          </div>
                          <div className="contact-request-count-badge">
                            {selectedSubmittedGroup.items.length} request{selectedSubmittedGroup.items.length !== 1 ? "s" : ""}
                          </div>
                        </div>

                        {selectedSubmittedGroup.items.length > 0 ? (
                          <div className="contact-request-card-grid">
                            {selectedSubmittedGroup.items.map((requestItem) => (
                              <div key={requestItem.id} className="contact-request-card">
                                <div className="contact-request-card-head">
                                  <div>
                                    <p className="contact-request-type">{requestItem.title}</p>
                                    <h5>{requestItem.requestCode || "Feedback Request"}</h5>
                                  </div>
                                  <span className="contact-request-status-chip">In Process</span>
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
                                    <strong>In Process</strong>
                                  </div>
                                </div>

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
    </section>
  );
}

export default WorkspacePage;
