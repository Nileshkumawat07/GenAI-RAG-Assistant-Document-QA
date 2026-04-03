import React, { useState } from "react";

function Careers() {
  const [selectedCategory, setSelectedCategory] = useState("positions");

  const categories = {
    positions: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Open Positions</h3>
        <p>Join our team of innovative thinkers and passionate builders. We're hiring for the following roles:</p>
        <ul style={styles.list}>
          <li><strong>Frontend Developer</strong> – React.js, Tailwind CSS</li>
          <li><strong>Backend Developer</strong> – Node.js, MongoDB</li>
          <li><strong>UI/UX Designer</strong> – Figma, Adobe XD</li>
          <li><strong>Product Manager</strong> – Agile, SaaS</li>
          <li><strong>DevOps Engineer</strong> – AWS, CI/CD</li>
        </ul>
        <button style={styles.primaryButton}>View All Roles</button>
      </div>
    ),
    life: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Life at Our Company</h3>
        <p>We believe in empowering our employees with flexibility, purpose, and opportunities to grow. Here's what working here looks like:</p>
        <ul style={styles.list}>
          <li>Work-from-anywhere policy with flexible hours</li>
          <li>Monthly knowledge-sharing workshops</li>
          <li>Quarterly team retreats and offsites</li>
          <li>Inclusive and diverse team culture</li>
        </ul>
        <button style={styles.primaryButton}>Explore Our Culture</button>
      </div>
    ),
    internship: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Internship Program</h3>
        <p>We offer 3 to 6-month internship opportunities for final year students and fresh graduates in:</p>
        <ul style={styles.list}>
          <li>Web Development</li>
          <li>UI/UX Design</li>
          <li>Product Management</li>
          <li>Data Analytics</li>
        </ul>
        <button style={styles.primaryButton}>Apply for Internship</button>
      </div>
    ),
    process: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Hiring Process</h3>
        <p>We value transparency and fairness. Our process includes:</p>
        <ul style={styles.list}>
          <li>Online Application & Resume Screening</li>
          <li>Phone Interview with HR</li>
          <li>Technical/Role Assessment</li>
          <li>Final Interview with Team Lead</li>
          <li>Offer & Onboarding</li>
        </ul>
        <button style={styles.primaryButton}>View Hiring Guide</button>
      </div>
    ),
    referral: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Referral Program</h3>
        <p>Know someone great? Refer them and earn up to Rs10,000 if they’re hired.</p>
        <ul style={styles.list}>
          <li>Submit a referral form</li>
          <li>Get notified if the referral is shortlisted</li>
          <li>Receive bonus on successful hire</li>
        </ul>
        <button style={styles.primaryButton}>Refer a Friend</button>
      </div>
    ),
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.sidebar}>
          <h2 style={styles.title}>Careers</h2>
          <p style={styles.description}>Explore career opportunities with us</p>
          <div style={styles.tabs}>
            {Object.keys(categories).map((key) => (
              <button
                key={key}
                style={{
                  ...styles.tab,
                  backgroundColor: selectedCategory === key ? "#1A237E" : "#fff",
                  color: selectedCategory === key ? "#fff" : "#212121",
                  border: selectedCategory === key ? "1px solid #1A237E" : "1px solid #ccc",
                }}
                onClick={() => setSelectedCategory(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.formSection}>
          <div style={styles.formCard}>{categories[selectedCategory]}</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Segoe UI, sans-serif", backgroundColor: "#F5F5F5", padding: "24px 20px", minHeight: "100%" },
  container: { maxWidth: "1400px", margin: "0 auto", display: "flex", backgroundColor: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" },
  sidebar: { flex: "1 1 280px", backgroundColor: "#ECEFF1", padding: "30px", borderRight: "1px solid #CFD8DC" },
  title: { fontSize: "24px", color: "#1A237E", marginBottom: "12px" },
  description: { fontSize: "14px", color: "#616161", marginBottom: "20px" },
  tabs: { display: "flex", flexDirection: "column", gap: "10px" },
  tab: { padding: "8px 12px", fontSize: "13px", cursor: "pointer", textAlign: "left", borderRadius: "6px", backgroundColor: "#fff", transition: "all 0.3s" },
  formSection: { flex: "2 1 1000px", padding: "40px", backgroundColor: "#FAFAFA" },
  formCard: { backgroundColor: "#fff", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", height: "550px", overflowY: "auto", display: "flex", flexDirection: "column" },
  cardBody: { display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", color: "#333" },
  sectionTitle: { fontSize: "18px", color: "#1A237E", marginBottom: "6px" },
  list: { paddingLeft: "20px", lineHeight: "1.6" },
  primaryButton: { marginTop: "12px", padding: "10px 16px", backgroundColor: "#1A237E", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" },
};

export default Careers;
