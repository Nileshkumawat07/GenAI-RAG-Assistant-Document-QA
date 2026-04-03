import React, { useState } from "react";

function Contactus() {
  const [selectedForm, setSelectedForm] = useState("general");
  const smallInput = { ...styles.input, minHeight: "30px", fontSize: "13px", padding: "6px 10px" };

  const forms = {
    general: (
      <form style={styles.form}>
        <div style={styles.row}>
          <input placeholder="First Name" style={smallInput} required />
          <input placeholder="Last Name" style={smallInput} required />
        </div>
        <input placeholder="Email" type="email" style={smallInput} required />
        <input placeholder="Phone Number" style={smallInput} />
        <input placeholder="City" style={smallInput} />
        <input placeholder="Preferred Contact Time" style={smallInput} />
        <textarea placeholder="Your Message" rows="3" style={styles.textarea} required />
        <button type="submit" style={styles.button}>Send Inquiry</button>
      </form>
    ),
    business: (
      <form style={styles.form}>
        <input placeholder="Company Name" style={smallInput} required />
        <input placeholder="Your Role" style={smallInput} required />
        <input type="email" placeholder="Business Email" style={smallInput} required />
        <input placeholder="Phone Number" style={smallInput} />
        <input placeholder="Website" style={smallInput} />
        <textarea placeholder="Business Proposal" rows="3" style={styles.textarea} required />
        <button type="submit" style={styles.button}>Submit Request</button>
      </form>
    ),
    feedback: (
      <form style={styles.form}>
        <input placeholder="Full Name" style={smallInput} required />
        <input type="email" placeholder="Email" style={smallInput} required />
        <select style={smallInput} required>
          <option value="">Rate Our Service</option>
          <option>Excellent</option>
          <option>Good</option>
          <option>Fair</option>
          <option>Poor</option>
        </select>
        <input placeholder="Service Used" style={smallInput} />
        <input placeholder="Date of Experience" style={smallInput} />
        <textarea placeholder="Your Feedback" rows="3" style={styles.textarea} required />
        <button type="submit" style={styles.button}>Send Feedback</button>
      </form>
    ),
    technical: (
      <form style={styles.form}>
        <input placeholder="Full Name" style={smallInput} required />
        <input type="email" placeholder="Email" style={smallInput} required />
        <input placeholder="Ticket ID" style={smallInput} />
        <input placeholder="Platform (Web/App)" style={smallInput} />
        <select style={smallInput} required>
          <option value="">Issue Type</option>
          <option>Login Problem</option>
          <option>Payment Issue</option>
          <option>Bug Report</option>
          <option>Other</option>
        </select>
        <textarea placeholder="Issue Description" rows="3" style={styles.textarea} required />
        <button type="submit" style={styles.button}>Submit Ticket</button>
      </form>
    ),
    partnership: (
      <form style={styles.form}>
        <input placeholder="Full Name" style={smallInput} required />
        <input placeholder="Organization" style={smallInput} />
        <input placeholder="Email" type="email" style={smallInput} required />
        <input placeholder="Phone Number" style={smallInput} />
        <input placeholder="Website / Portfolio" style={smallInput} />
        <textarea placeholder="Partnership Details" rows="3" style={styles.textarea} required />
        <button type="submit" style={styles.button}>Submit Proposal</button>
      </form>
    ),
    media: (
      <form style={styles.form}>
        <input placeholder="Full Name" style={smallInput} required />
        <input placeholder="Media Company" style={smallInput} />
        <input type="email" placeholder="Official Email" style={smallInput} required />
        <input placeholder="Phone Number" style={smallInput} />
        <input placeholder="Publication / Channel" style={smallInput} />
        <textarea placeholder="Media Request Details" rows="3" style={styles.textarea} required />
        <button type="submit" style={styles.button}>Send Request</button>
      </form>
    ),
  };

  return (
    <div style={styles.page}>
      <style>{`@keyframes fadeIn {from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }} .fade-in {animation: fadeIn 0.5s ease-out forwards; opacity: 0;}`}</style>
      <div style={styles.container} className="fade-in">
        <div style={styles.sidebar}>
          <h1 style={styles.title}>Contact Us</h1>
          <p style={styles.description}>Select a category to get started</p>
          <div style={styles.tabs}>
            {Object.keys(forms).map((key) => (
              <button
                key={key}
                style={{
                  ...styles.tab,
                  backgroundColor: selectedForm === key ? "#1A237E" : "#fff",
                  color: selectedForm === key ? "#fff" : "#212121",
                  border: selectedForm === key ? "1px solid #1A237E" : "1px solid #ccc",
                }}
                onClick={() => setSelectedForm(key)}
              >
                {key === "general" && "General Inquiry"}
                {key === "business" && "Business"}
                {key === "feedback" && "Feedback"}
                {key === "technical" && "Technical Support"}
                {key === "partnership" && "Partnership"}
                {key === "media" && "Media & Press"}
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
            <h2 style={styles.cardTitle}>{selectedForm.replace(/^\w/, (c) => c.toUpperCase())}</h2>
            {forms[selectedForm]}
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
};

export default Contactus;
