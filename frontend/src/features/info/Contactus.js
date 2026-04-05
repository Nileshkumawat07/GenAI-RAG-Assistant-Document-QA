import React, { useMemo, useState } from "react";

import { saveContactSubmission } from "../../shared/firebase/firestore";

const FORM_FIELDS = {
  general: [
    { key: "firstName", placeholder: "First Name", required: true, row: true },
    { key: "lastName", placeholder: "Last Name", required: true, row: true },
    { key: "email", placeholder: "Email", type: "email", required: true },
    { key: "phoneNumber", placeholder: "Phone Number" },
    { key: "city", placeholder: "City" },
    { key: "preferredContactTime", placeholder: "Preferred Contact Time" },
    { key: "message", placeholder: "Your Message", textarea: true, required: true },
  ],
  business: [
    { key: "companyName", placeholder: "Company Name", required: true },
    { key: "role", placeholder: "Your Role", required: true },
    { key: "email", placeholder: "Business Email", type: "email", required: true },
    { key: "phoneNumber", placeholder: "Phone Number" },
    { key: "website", placeholder: "Website" },
    { key: "message", placeholder: "Business Proposal", textarea: true, required: true },
  ],
  feedback: [
    { key: "fullName", placeholder: "Full Name", required: true },
    { key: "email", placeholder: "Email", type: "email", required: true },
    { key: "rating", placeholder: "Rate Our Service", select: ["Excellent", "Good", "Fair", "Poor"], required: true },
    { key: "serviceUsed", placeholder: "Service Used" },
    { key: "experienceDate", placeholder: "Date of Experience" },
    { key: "message", placeholder: "Your Feedback", textarea: true, required: true },
  ],
  technical: [
    { key: "fullName", placeholder: "Full Name", required: true },
    { key: "email", placeholder: "Email", type: "email", required: true },
    { key: "ticketId", placeholder: "Ticket ID" },
    { key: "platform", placeholder: "Platform (Web/App)" },
    { key: "issueType", placeholder: "Issue Type", select: ["Login Problem", "Payment Issue", "Bug Report", "Other"], required: true },
    { key: "message", placeholder: "Issue Description", textarea: true, required: true },
  ],
  partnership: [
    { key: "fullName", placeholder: "Full Name", required: true },
    { key: "organization", placeholder: "Organization" },
    { key: "email", placeholder: "Email", type: "email", required: true },
    { key: "phoneNumber", placeholder: "Phone Number" },
    { key: "website", placeholder: "Website / Portfolio" },
    { key: "message", placeholder: "Partnership Details", textarea: true, required: true },
  ],
  media: [
    { key: "fullName", placeholder: "Full Name", required: true },
    { key: "mediaCompany", placeholder: "Media Company" },
    { key: "email", placeholder: "Official Email", type: "email", required: true },
    { key: "phoneNumber", placeholder: "Phone Number" },
    { key: "publication", placeholder: "Publication / Channel" },
    { key: "message", placeholder: "Media Request Details", textarea: true, required: true },
  ],
};

const FORM_TITLES = {
  general: "General Inquiry",
  business: "Business",
  feedback: "Feedback",
  technical: "Technical Support",
  partnership: "Partnership",
  media: "Media & Press",
};

const FORM_BUTTONS = {
  general: "Send Inquiry",
  business: "Submit Request",
  feedback: "Send Feedback",
  technical: "Submit Ticket",
  partnership: "Submit Proposal",
  media: "Send Request",
};

function buildFormState(formKey) {
  return FORM_FIELDS[formKey].reduce((accumulator, field) => {
    accumulator[field.key] = "";
    return accumulator;
  }, {});
}

function Contactus() {
  const [selectedForm, setSelectedForm] = useState("general");
  const [formValues, setFormValues] = useState(() => buildFormState("general"));
  const [status, setStatus] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const smallInput = { ...styles.input, minHeight: "30px", fontSize: "13px", padding: "6px 10px" };
  const fields = useMemo(() => FORM_FIELDS[selectedForm], [selectedForm]);

  const switchForm = (nextForm) => {
    setSelectedForm(nextForm);
    setFormValues(buildFormState(nextForm));
    setStatus({ type: "", text: "" });
  };

  const setFieldValue = (key, value) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    for (const field of fields) {
      if (field.required && !String(formValues[field.key] || "").trim()) {
        setStatus({ type: "error", text: `Please fill ${field.placeholder}.` });
        return;
      }
    }

    try {
      setSubmitting(true);
      const requestToken = await saveContactSubmission({
        category: selectedForm,
        title: FORM_TITLES[selectedForm],
        values: formValues,
      });
      setFormValues(buildFormState(selectedForm));
      setStatus({
        type: "success",
        text: `Submitted successfully. Tick confirmed. Request token: ${requestToken}`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        text: error.message || "Failed to send request.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const rowFields = fields.filter((field) => field.row);
  const otherFields = fields.filter((field) => !field.row);

  const renderField = (field) => {
    if (field.select) {
      return (
        <select
          key={field.key}
          style={smallInput}
          value={formValues[field.key]}
          onChange={(event) => setFieldValue(field.key, event.target.value)}
          required={field.required}
        >
          <option value="">{field.placeholder}</option>
          {field.select.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.textarea) {
      return (
        <textarea
          key={field.key}
          placeholder={field.placeholder}
          rows="3"
          style={styles.textarea}
          value={formValues[field.key]}
          onChange={(event) => setFieldValue(field.key, event.target.value)}
          required={field.required}
        />
      );
    }

    return (
      <input
        key={field.key}
        placeholder={field.placeholder}
        type={field.type || "text"}
        style={smallInput}
        value={formValues[field.key]}
        onChange={(event) => setFieldValue(field.key, event.target.value)}
        required={field.required}
      />
    );
  };

  return (
    <div style={styles.page}>
      <style>{`@keyframes fadeIn {from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }} .fade-in {animation: fadeIn 0.5s ease-out forwards; opacity: 0;}`}</style>
      <div style={styles.container} className="fade-in">
        <div style={styles.sidebar}>
          <h1 style={styles.title}>Contact Us</h1>
          <p style={styles.description}>Select a category to get started</p>
          <div style={styles.tabs}>
            {Object.keys(FORM_FIELDS).map((key) => (
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
                {FORM_TITLES[key]}
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
        <div style={styles.formSection}>
          <div style={styles.formCard}>
            <h2 style={styles.cardTitle}>{FORM_TITLES[selectedForm]}</h2>
            <form style={styles.form} onSubmit={handleSubmit}>
              {rowFields.length > 0 ? <div style={styles.row}>{rowFields.map((field) => renderField(field))}</div> : null}
              {otherFields.map((field) => renderField(field))}
              {status.text ? (
                <div style={status.type === "success" ? styles.successBox : styles.errorBox}>
                  {status.type === "success" ? "✓ " : ""}
                  {status.text}
                </div>
              ) : null}
              <button type="submit" style={styles.button} disabled={submitting}>
                {submitting ? "Submitting..." : FORM_BUTTONS[selectedForm]}
              </button>
            </form>
          </div>
          <div style={{ width: "100%", backgroundColor: "#E8EAF6", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", marginTop: "20px" }}>
            <p style={{ fontSize: "13px", color: "#1A237E", fontWeight: "600", marginBottom: "8px" }}>
              You can expect a response from us within three business days. We value your time and strive to resolve your issue or provide clarity as efficiently as possible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Segoe UI, sans-serif", backgroundColor: "#F5F5F5", minHeight: "100%", padding: "24px 20px", boxSizing: "border-box" },
  container: { maxWidth: "1400px", margin: "0 auto", backgroundColor: "#FFFFFF", display: "flex", flexWrap: "wrap", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" },
  sidebar: { flex: "1 1 280px", backgroundColor: "#ECEFF1", padding: "30px", borderRight: "1px solid #CFD8DC" },
  title: { fontSize: "24px", color: "#1A237E", marginBottom: "12px" },
  description: { fontSize: "14px", color: "#546E7A", marginBottom: "20px" },
  tabs: { display: "flex", flexDirection: "column", gap: "10px" },
  tab: { padding: "8px 12px", borderRadius: "6px", fontSize: "13px", cursor: "pointer", textAlign: "left", transition: "all 0.3s ease", backgroundColor: "#fff" },
  contactInfo: { marginTop: "30px", fontSize: "13px", color: "#546E7A" },
  contactTitle: { fontWeight: "bold", color: "#1A237E", marginBottom: "8px" },
  formSection: { flex: "2 1 1000px", padding: "40px", backgroundColor: "#FAFAFA" },
  formCard: { backgroundColor: "#FFFFFF", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", marginBottom: "20px" },
  cardTitle: { fontSize: "20px", marginBottom: "20px", color: "#212121" },
  form: { display: "flex", flexDirection: "column", gap: "10px" },
  row: { display: "flex", gap: "10px", flexWrap: "wrap" },
  input: { flex: 1, border: "1px solid #CCC", borderRadius: "6px", fontSize: "14px", padding: "8px 10px" },
  textarea: { border: "1px solid #CCC", borderRadius: "6px", fontSize: "14px", padding: "8px 10px", minHeight: "80px", resize: "vertical" },
  button: { marginTop: "12px", padding: "10px", backgroundColor: "#1A237E", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer", transition: "background 0.3s" },
  successBox: { padding: "10px 12px", borderRadius: "6px", backgroundColor: "#E8F5E9", color: "#1B5E20", border: "1px solid #A5D6A7", fontSize: "13px", fontWeight: "600" },
  errorBox: { padding: "10px 12px", borderRadius: "6px", backgroundColor: "#FFEBEE", color: "#B71C1C", border: "1px solid #FFCDD2", fontSize: "13px", fontWeight: "600" },
};

export default Contactus;
