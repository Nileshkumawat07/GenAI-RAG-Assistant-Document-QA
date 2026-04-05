import React, { useMemo, useState } from "react";

import { saveContactSubmission } from "../../shared/firebase/firestore";

const FORM_CONFIG = {
  general: {
    title: "General Inquiry",
    button: "Send Inquiry",
    fields: [
      { name: "firstName", label: "First Name", type: "text", required: true, half: true },
      { name: "lastName", label: "Last Name", type: "text", required: true, half: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phoneNumber", label: "Phone Number", type: "tel" },
      { name: "city", label: "City", type: "text" },
      { name: "preferredContactTime", label: "Preferred Contact Time", type: "text" },
      { name: "message", label: "Your Message", type: "textarea", required: true },
    ],
  },
  business: {
    title: "Business",
    button: "Submit Request",
    fields: [
      { name: "companyName", label: "Company Name", type: "text", required: true },
      { name: "role", label: "Your Role", type: "text", required: true },
      { name: "email", label: "Business Email", type: "email", required: true },
      { name: "phoneNumber", label: "Phone Number", type: "tel" },
      { name: "website", label: "Website", type: "text" },
      { name: "message", label: "Business Proposal", type: "textarea", required: true },
    ],
  },
  feedback: {
    title: "Feedback",
    button: "Send Feedback",
    fields: [
      { name: "fullName", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "rating", label: "Rate Our Service", type: "select", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { name: "serviceUsed", label: "Service Used", type: "text" },
      { name: "experienceDate", label: "Date of Experience", type: "date" },
      { name: "message", label: "Your Feedback", type: "textarea", required: true },
    ],
  },
  technical: {
    title: "Technical Support",
    button: "Submit Ticket",
    fields: [
      { name: "fullName", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "ticketId", label: "Ticket ID", type: "text" },
      { name: "platform", label: "Platform (Web/App)", type: "text" },
      { name: "issueType", label: "Issue Type", type: "select", required: true, options: ["Login Problem", "Payment Issue", "Bug Report", "Other"] },
      { name: "message", label: "Issue Description", type: "textarea", required: true },
    ],
  },
  partnership: {
    title: "Partnership",
    button: "Submit Proposal",
    fields: [
      { name: "fullName", label: "Full Name", type: "text", required: true },
      { name: "organization", label: "Organization", type: "text" },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phoneNumber", label: "Phone Number", type: "tel" },
      { name: "website", label: "Website / Portfolio", type: "text" },
      { name: "message", label: "Partnership Details", type: "textarea", required: true },
    ],
  },
  media: {
    title: "Media & Press",
    button: "Send Request",
    fields: [
      { name: "fullName", label: "Full Name", type: "text", required: true },
      { name: "mediaCompany", label: "Media Company", type: "text" },
      { name: "email", label: "Official Email", type: "email", required: true },
      { name: "phoneNumber", label: "Phone Number", type: "tel" },
      { name: "publication", label: "Publication / Channel", type: "text" },
      { name: "message", label: "Media Request Details", type: "textarea", required: true },
    ],
  },
};

function createFormState(formKey) {
  return FORM_CONFIG[formKey].fields.reduce((accumulator, field) => {
    accumulator[field.name] = "";
    return accumulator;
  }, {});
}

function Contactus({ embedded = false }) {
  const [selectedForm, setSelectedForm] = useState("general");
  const [formValues, setFormValues] = useState(() => createFormState("general"));
  const [status, setStatus] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  const activeForm = useMemo(() => FORM_CONFIG[selectedForm], [selectedForm]);
  const smallInput = { ...styles.input, minHeight: "40px", fontSize: "13px", padding: "9px 12px" };

  const switchForm = (nextForm) => {
    setSelectedForm(nextForm);
    setFormValues(createFormState(nextForm));
    setStatus({ type: "", text: "" });
  };

  const setFieldValue = (fieldName, value) => {
    setFormValues((current) => ({
      ...current,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    for (const field of activeForm.fields) {
      if (field.required && !String(formValues[field.name] || "").trim()) {
        setStatus({ type: "error", text: `Please fill ${field.label}.` });
        return;
      }
    }

    try {
      setSubmitting(true);
      const submissionId = await saveContactSubmission({
        category: selectedForm,
        title: activeForm.title,
        values: formValues,
      });
      setFormValues(createFormState(selectedForm));
      setStatus({ type: "success", text: `Submitted successfully. Reference ID: ${submissionId}` });
    } catch (error) {
      setStatus({ type: "error", text: error.message || "Failed to send your request." });
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    if (field.type === "textarea") {
      return (
        <textarea
          key={field.name}
          placeholder={field.label}
          rows="4"
          style={styles.textarea}
          value={formValues[field.name]}
          onChange={(event) => setFieldValue(field.name, event.target.value)}
          required={field.required}
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          key={field.name}
          style={smallInput}
          value={formValues[field.name]}
          onChange={(event) => setFieldValue(field.name, event.target.value)}
          required={field.required}
        >
          <option value="">{field.label}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        key={field.name}
        type={field.type}
        placeholder={field.label}
        style={{ ...smallInput, width: field.half ? "calc(50% - 5px)" : "100%" }}
        value={formValues[field.name]}
        onChange={(event) => setFieldValue(field.name, event.target.value)}
        required={field.required}
      />
    );
  };

  const rowFields = activeForm.fields.filter((field) => field.half);
  const blockFields = activeForm.fields.filter((field) => !field.half);

  const content = (
    <>
      <div style={embedded ? styles.embeddedSidebar : styles.sidebar}>
          <h1 style={styles.title}>Contact Us</h1>
          <p style={styles.description}>Select a category to get started</p>
          <div style={styles.tabs}>
            {Object.entries(FORM_CONFIG).map(([key, config]) => (
              <button
                key={key}
                style={{
                  ...styles.tab,
                  backgroundColor: selectedForm === key ? "#1A237E" : "#fff",
                  color: selectedForm === key ? "#fff" : "#212121",
                  border: selectedForm === key ? "1px solid #1A237E" : "1px solid #ccc",
                }}
                onClick={() => switchForm(key)}
                type="button"
              >
                {config.title}
              </button>
            ))}
          </div>
          <div style={styles.contactInfo}>
            <h4 style={styles.contactTitle}>Contact Details</h4>
            <p>Mumbai, India</p>
            <p>hello@yourcompany.com</p>
            <p>+91 98765 43210</p>
          </div>
      </div>
      <div style={embedded ? styles.embeddedFormSection : styles.formSection}>
        <div style={embedded ? styles.embeddedFormCard : styles.formCard}>
          <h2 style={styles.cardTitle}>{activeForm.title}</h2>
          <form style={styles.form} onSubmit={handleSubmit}>
            {rowFields.length > 0 ? <div style={styles.row}>{rowFields.map((field) => renderField(field))}</div> : null}
            {blockFields.map((field) => renderField(field))}
            {status.text ? (
              <div
                style={{
                  ...styles.status,
                  ...(status.type === "success" ? styles.successStatus : styles.errorStatus),
                }}
              >
                {status.text}
              </div>
            ) : null}
            <button type="submit" style={styles.button} disabled={submitting}>
              {submitting ? "Submitting..." : activeForm.button}
            </button>
          </form>
        </div>
        <div style={styles.infoBanner}>
          <p style={styles.infoText}>
            Contact requests are now stored in Firebase so your team can review them later. You can expect a response from us within three business days.
          </p>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div style={styles.embeddedContainer}>{content}</div>;
  }

  return (
    <div style={styles.page}>
      <style>{`@keyframes fadeIn {from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }} .fade-in {animation: fadeIn 0.5s ease-out forwards; opacity: 0;}`}</style>
      <div style={styles.container} className="fade-in">
        {content}
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Segoe UI, sans-serif", backgroundColor: "#F5F5F5", minHeight: "100%", padding: "24px 20px", boxSizing: "border-box" },
  container: { maxWidth: "1400px", margin: "0 auto", backgroundColor: "#FFFFFF", display: "flex", flexWrap: "wrap", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" },
  embeddedContainer: { display: "flex", flexWrap: "wrap", gap: "18px", alignItems: "flex-start" },
  sidebar: { flex: "1 1 280px", backgroundColor: "#ECEFF1", padding: "30px", borderRight: "1px solid #CFD8DC" },
  embeddedSidebar: { flex: "0 0 280px", backgroundColor: "#ECEFF1", padding: "30px", borderRadius: "12px", border: "1px solid #CFD8DC" },
  title: { fontSize: "24px", color: "#1A237E", marginBottom: "12px" },
  description: { fontSize: "14px", color: "#546E7A", marginBottom: "20px" },
  tabs: { display: "flex", flexDirection: "column", gap: "10px" },
  tab: { padding: "10px 12px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", textAlign: "left", transition: "all 0.3s ease", backgroundColor: "#fff", fontWeight: 600 },
  contactInfo: { marginTop: "30px", fontSize: "13px", color: "#546E7A" },
  contactTitle: { fontWeight: "bold", color: "#1A237E", marginBottom: "8px" },
  formSection: { flex: "2 1 1000px", padding: "40px", backgroundColor: "#FAFAFA" },
  embeddedFormSection: { flex: "1 1 640px", minWidth: 0 },
  formCard: { backgroundColor: "#FFFFFF", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", marginBottom: "20px" },
  embeddedFormCard: { backgroundColor: "#FFFFFF", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", marginBottom: "20px", border: "1px solid #E2E8F0" },
  cardTitle: { fontSize: "20px", marginBottom: "20px", color: "#212121" },
  form: { display: "flex", flexDirection: "column", gap: "10px" },
  row: { display: "flex", gap: "10px", flexWrap: "wrap" },
  input: { flex: 1, border: "1px solid #CCC", borderRadius: "6px", fontSize: "14px", padding: "8px 10px", boxSizing: "border-box" },
  textarea: { border: "1px solid #CCC", borderRadius: "6px", fontSize: "14px", padding: "10px 12px", minHeight: "90px", resize: "vertical", boxSizing: "border-box" },
  button: { marginTop: "12px", padding: "12px 16px", backgroundColor: "#1A237E", color: "#FFFFFF", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "background 0.3s" },
  status: { padding: "12px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600 },
  successStatus: { backgroundColor: "#E8F5E9", color: "#1B5E20", border: "1px solid #A5D6A7" },
  errorStatus: { backgroundColor: "#FFEBEE", color: "#B71C1C", border: "1px solid #FFCDD2" },
  infoBanner: { width: "100%", backgroundColor: "#E8EAF6", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", marginTop: "20px" },
  infoText: { fontSize: "13px", color: "#1A237E", fontWeight: "600", marginBottom: "8px" },
};

export default Contactus;
