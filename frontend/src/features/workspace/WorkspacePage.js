import React, { useMemo, useState } from "react";

import DocumentRetrievalPanel from "../document-retrieval/DocumentRetrievalPanel";
import ImageGenerationPanel from "../image-generation/ImageGenerationPanel";
import ObjectDetectionPanel from "../object-detection/ObjectDetectionPanel";
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
};

function WorkspacePage({ selectedInfoPage = null }) {
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

  const infoConfig = selectedInfoPage ? INFO_PAGE_CONFIG[selectedInfoPage] : null;
  const activeInfoTab = useMemo(() => {
    if (!infoConfig) return null;
    return infoTabs[selectedInfoPage] || infoConfig.tabs[0].id;
  }, [infoConfig, infoTabs, selectedInfoPage]);
  const activeInfoContent = infoConfig
    ? infoConfig.tabs.find((item) => item.id === activeInfoTab) || infoConfig.tabs[0]
    : null;

  const hasQuestion = question.trim().length > 0;

  const pushStatus = (text, type = "info") => {
    setStatusFeed((current) =>
      [{ text, type }, ...current.filter((item) => item.text !== text)].slice(0, 6)
    );
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
                  <input key={field} className="auth-input workspace-static-input" placeholder={field} />
                ))}
                <textarea
                  className="question-input workspace-static-textarea"
                  rows={4}
                  placeholder={activeInfoContent.textarea}
                />
                <button className="primary-button" type="button">
                  {activeInfoContent.button}
                </button>
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

          <div className="sidebar-boost-card">
            <div className="sidebar-status">
              <h4>{infoConfig ? infoConfig.statusTitle : activeSection === "document-retrieval" ? "Document Retrieval Status" : activeSection === "object-detection" ? "Object Detection Status" : "Image Generation Status"}</h4>
              <div className="status-feed">
                {infoConfig
                  ? infoConfig.statusItems.map((item) => (
                      <p key={item} className="status-item status-info">
                        {item}
                      </p>
                    ))
                  : statusContent}
              </div>
            </div>
          </div>
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
