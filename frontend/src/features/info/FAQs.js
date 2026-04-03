import React, { useState } from "react";

function FAQs() {
  const [selectedTopic, setSelectedTopic] = useState("general");

  const generateFAQSection = (title, qnaList) => (
    <div style={styles.cardBody}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {qnaList.map((item, index) => (
        <div key={index} style={styles.faqCard}>
          <p><strong>{item.q}</strong></p>
          <p>{item.a}</p>
        </div>
      ))}
    </div>
  );

  const faqContent = {
    general: generateFAQSection("General Questions", [
      { q: "What is the purpose of this platform?", a: "To deliver secure and scalable solutions for users across industries with a focus on efficiency and ease of use." },
      { q: "Who can use this platform?", a: "Our tools are designed for individuals, startups, and enterprise-level organizations seeking digital transformation." },
      { q: "Do you offer a trial version?", a: "Yes, most plans come with a 7-day free trial to help users explore features before committing." },
      { q: "Is the platform mobile-friendly?", a: "Yes. Our interfaces are fully responsive and optimized for mobile devices." },
      { q: "Can I invite collaborators?", a: "Yes, multi-user support is available in most paid plans allowing collaborative workspaces." },
      { q: "Do you support multi-language UI?", a: "Yes, we support English, Spanish, French, and more. Language settings can be changed in preferences." },
      { q: "How often is the platform updated?", a: "We push updates bi-weekly, including security patches, features, and performance improvements." },
      { q: "Where can I see what’s new?", a: "Release notes are shared via the dashboard and through email announcements." },
      { q: "Do you offer webinars or training?", a: "Yes, training resources are available via our Learning Hub and weekly webinars." },
      { q: "Can I give feedback?", a: "Yes, we welcome feedback through the platform or via our support email." },
    ]),
    billing: generateFAQSection("Billing & Payments", [
      { q: "What payment methods do you accept?", a: "We accept major credit/debit cards, PayPal, Stripe, and bank transfers for enterprise clients." },
      { q: "How do I view my invoice?", a: "Invoices are available in your account dashboard under Billing History." },
      { q: "Can I get a refund?", a: "Refunds are handled case-by-case. Contact support within 7 days for eligible cases." },
      { q: "Is GST or VAT applicable?", a: "Yes, applicable taxes will be calculated at checkout based on your region." },
      { q: "How do I change my billing cycle?", a: "You can switch between monthly and yearly cycles from your Billing Settings." },
      { q: "What happens if my payment fails?", a: "You will receive a notification and we will retry payment for up to 7 days." },
      { q: "Can I pause my subscription?", a: "Yes, paid users can pause billing for up to 30 days once a year." },
      { q: "How is usage billed?", a: "Billing is based on plan tier and any extra features you subscribe to." },
      { q: "How do I cancel auto-renewal?", a: "Turn off auto-renew from the Billing section in your settings." },
      { q: "Are enterprise quotes negotiable?", a: "Yes, custom enterprise deals are tailored after discussion with our sales team." },
    ]),
    technical: generateFAQSection("Technical Support", [
      { q: "How do I contact tech support?", a: "Use the Help Center chat, email us, or call support for urgent matters." },
      { q: "What is the average response time?", a: "Under 2 hours for Pro/Enterprise users and within 12 hours for Free users." },
      { q: "Where can I report a bug?", a: "Bug reports can be submitted through the feedback form on your dashboard." },
      { q: "Do you provide documentation?", a: "Yes, a full API and user documentation is available in our Dev Center." },
      { q: "What browsers are supported?", a: "Latest versions of Chrome, Firefox, Safari, and Edge are fully supported." },
      { q: "Can I test features before enabling?", a: "Yes, you can use our sandbox environment for safe testing." },
      { q: "Do you offer uptime guarantees?", a: "Yes, 99.9% uptime backed by SLAs for enterprise clients." },
      { q: "How do I submit a feature request?", a: "Feature requests are collected through our Feedback Hub." },
      { q: "Do you support SSO or OAuth?", a: "Yes, Single Sign-On and OAuth integrations are available for Pro and above." },
      { q: "Is live support available?", a: "Live chat is available 9am-6pm IST, Monday to Friday." },
    ]),
    security: generateFAQSection("Security & Compliance", [
      { q: "Is my data encrypted?", a: "Yes, data is encrypted at rest and in transit using AES-256 and TLS 1.2+" },
      { q: "Are you GDPR compliant?", a: "Yes, we fully comply with GDPR and allow data deletion on request." },
      { q: "How do you handle data breaches?", a: "Incidents are immediately reported to affected users and authorities within 72 hours." },
      { q: "Is 2FA available?", a: "Yes, Two-Factor Authentication can be enabled via your account settings." },
      { q: "Where are your servers located?", a: "We operate multi-region servers in the US, Europe, and Asia-Pacific." },
      { q: "How do I report security issues?", a: "Email security@yourcompany.com for responsible disclosure." },
      { q: "Are backups available?", a: "Yes, automated daily backups are performed and securely stored." },
      { q: "How do I review audit logs?", a: "Audit trails are available to admins in the Security tab." },
      { q: "Do you support IP whitelisting?", a: "Yes, available for enterprise clients with custom firewall rules." },
      { q: "How often are systems audited?", a: "We conduct quarterly internal and annual third-party audits." },
    ]),
    accounts: generateFAQSection("Account Management", [
      { q: "How do I update my profile?", a: "Go to Account Settings and click on Edit Profile to change your details." },
      { q: "Can I delete my account?", a: "Yes, under Privacy Settings, click on Delete Account and confirm via OTP." },
      { q: "How do I reset my password?", a: "Click Forgot Password on the login screen and follow the verification steps." },
      { q: "What if I lose access to my email?", a: "Contact support with ID verification to recover or change email address." },
      { q: "How do I enable notifications?", a: "You can enable/disable email, mobile, or browser alerts in Notification Settings." },
      { q: "Can I link social media accounts?", a: "Yes, you can link Facebook, Google, LinkedIn and GitHub accounts." },
      { q: "What are account roles?", a: "Roles define user privileges like Admin, Editor, Viewer. Set under Team Settings." },
      { q: "Can I change my username?", a: "Yes, under Account Info. Changes require OTP verification." },
      { q: "Do you log user sessions?", a: "Yes, view past login history under Security Logs." },
      { q: "What if my account is locked?", a: "Wait 30 minutes or contact support to unlock if too many failed attempts." },
    ]),
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.sidebar}>
          <h2 style={styles.title}>FAQs</h2>
          <p style={styles.description}>Find answers to common questions</p>
          <div style={styles.tabs}>
            {Object.keys(faqContent).map((key) => (
              <button
                key={key}
                style={{
                  ...styles.tab,
                  backgroundColor: selectedTopic === key ? "#1A237E" : "#fff",
                  color: selectedTopic === key ? "#fff" : "#212121",
                  border: selectedTopic === key ? "1px solid #1A237E" : "1px solid #ccc",
                }}
                onClick={() => setSelectedTopic(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.formSection}>
          <div style={styles.formCard}>{faqContent[selectedTopic]}</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Segoe UI, sans-serif", backgroundColor: "#F5F5F5", padding: "24px 20px", minHeight: "100%", boxSizing: "border-box" },
  container: { maxWidth: "1400px", margin: "0 auto", display: "flex", backgroundColor: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.08)", height: "650px" },
  sidebar: { flex: "1 1 280px", backgroundColor: "#ECEFF1", padding: "30px", borderRight: "1px solid #CFD8DC" },
  title: { fontSize: "24px", color: "#1A237E", marginBottom: "12px" },
  description: { fontSize: "14px", color: "#546E7A", marginBottom: "20px" },
  tabs: { display: "flex", flexDirection: "column", gap: "10px" },
  tab: { padding: "8px 12px", fontSize: "13px", cursor: "pointer", borderRadius: "6px", backgroundColor: "#fff", textAlign: "left", transition: "all 0.3s ease" },
  formSection: { flex: "2 1 1000px", padding: "40px", backgroundColor: "#FAFAFA" },
  formCard: { backgroundColor: "#fff", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", height: "100%", overflowY: "auto" },
  cardBody: { display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", color: "#333" },
  sectionTitle: { fontSize: "18px", color: "#1A237E", marginBottom: "10px" },
  faqCard: { backgroundColor: "#F0F4FF", padding: "15px 20px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
};

export default FAQs;
