import React, { useState } from "react";

function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState("individual");

  const pricingData = {
    individual: [
      { title: "Free Plan", price: "$0 / month", description: "For basic personal use with limited features.", features: ["1 user account", "Basic tools only", "Community forum access", "1GB storage"], note: "Does not include customer support or export tools." },
      { title: "Pro Plan", price: "$9 / month", description: "Ideal for individuals with moderate needs.", features: ["Up to 3 devices", "10GB cloud backup", "Email support", "Data export options"], note: "Includes 7-day free trial. Cancel anytime." },
    ],
    business: [
      { title: "Startup", price: "$29 / month", description: "Best for small teams and collaborative work.", features: ["Up to 5 users", "Collaboration dashboard", "Team analytics", "Chat & email support"], note: "Free onboarding included." },
      { title: "Growth", price: "$59 / month", description: "Advanced tools for expanding businesses.", features: ["Unlimited team members", "Custom reporting tools", "24/7 support", "Third-party integrations"], note: "Save 15% with annual plan." },
    ],
    enterprise: [
      { title: "Enterprise", price: "Custom Pricing", description: "Tailored for large organizations with advanced needs.", features: ["Custom SLA", "Dedicated account manager", "Role-based access control", "On-premise options"], note: "Contact sales for a custom quote." },
    ],
    developer: [
      { title: "Developer Access", price: "$19 / month", description: "Tools and APIs for developer integration.", features: ["API sandbox", "Unlimited calls", "Webhook support", "Private dev Slack"], note: "Great for testing and prototyping." },
    ],
    education: [
      { title: "Student Plan", price: "Free", description: "Access to Pro tools for students.", features: ["All Pro features", "2 devices allowed", "Extended trial"], note: "Valid .edu or school email required." },
    ],
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.sidebar}>
          <h1 style={styles.title}>Pricing</h1>
          <p style={styles.description}>Choose a plan category</p>
          <div style={styles.tabs}>
            {Object.keys(pricingData).map((key) => (
              <button
                key={key}
                style={{
                  ...styles.tab,
                  backgroundColor: selectedPlan === key ? "#1A237E" : "#fff",
                  color: selectedPlan === key ? "#fff" : "#212121",
                  border: selectedPlan === key ? "1px solid #1A237E" : "1px solid #ccc",
                }}
                onClick={() => setSelectedPlan(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          <div style={styles.contactInfo}>
            <h4 style={styles.contactTitle}>Need Help?</h4>
            <p>support@yourcompany.com</p>
            <p>+91 98765 43210</p>
          </div>
        </div>
        <div style={styles.formSection}>
          <div style={styles.noteCard}>
            <p style={styles.noteText}>All pricing plans are billed in USD. Cancel anytime. Features and access may vary depending on your region and compliance requirements.</p>
          </div>
          <div style={styles.formCard}>
            <h2 style={styles.cardTitle}>{selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plans</h2>
            <div style={styles.cardGrid}>
              {pricingData[selectedPlan].map((plan, index) => (
                <div key={index} style={styles.planCard}>
                  <h3 style={styles.planTitle}>{plan.title}</h3>
                  <p style={styles.planPrice}>{plan.price}</p>
                  <p style={styles.planDescription}>{plan.description}</p>
                  <ul style={styles.featureList}>
                    {plan.features.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                  <p style={styles.planNote}><strong>Note:</strong> {plan.note}</p>
                  <button style={styles.button}>Select Plan</button>
                </div>
              ))}
            </div>
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
  formCard: { backgroundColor: "#FFFFFF", padding: "30px", height: "450px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", marginTop: "20px" },
  cardTitle: { fontSize: "20px", marginBottom: "20px", color: "#212121" },
  cardGrid: { display: "flex", flexWrap: "wrap", gap: "20px" },
  planCard: { flex: "1 1 48%", backgroundColor: "#E8EAF6", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" },
  planTitle: { fontSize: "17px", fontWeight: "600", color: "#1A237E", marginBottom: "5px" },
  planPrice: { fontSize: "15px", color: "#37474F", marginBottom: "8px" },
  planDescription: { fontSize: "14px", color: "#455A64", marginBottom: "10px" },
  featureList: { fontSize: "13px", paddingLeft: "20px", marginBottom: "10px", color: "#37474F" },
  planNote: { fontSize: "13px", color: "#1A237E", marginBottom: "10px" },
  button: { marginTop: "12px", padding: "10px", backgroundColor: "#1A237E", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer", transition: "background 0.3s" },
  noteCard: { width: "100%", backgroundColor: "#E8EAF6", padding: "20px 30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
  noteText: { fontSize: "13px", color: "#1A237E", fontWeight: "600" },
};

export default Pricing;
