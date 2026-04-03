import React, { useState } from "react";

function AboutUs() {
  const [selectedCategory, setSelectedCategory] = useState("company");

  const categories = {
    company: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Who We Are</h3>
        <p>Founded in 2020, our company is a trusted name in delivering secure, scalable technology solutions. Based in Jaipur, with offices across the USA and Europe, we address global challenges in finance, healthcare, and education sectors.</p>
        <p>Our team of 100+ engineers and designers is dedicated to user-centered innovation and agile delivery methodologies, helping clients grow sustainably while embracing digital transformation.</p>
        <button style={styles.primaryButton}>Download Company Brochure</button>
      </div>
    ),
    mission: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Our Mission</h3>
        <p>To empower organizations by building future-ready digital platforms that drive efficiency, improve experiences, and foster growth.</p>
        <h3 style={styles.sectionTitle}>Our Vision</h3>
        <p>To become a global leader in trusted digital transformation, known for ethical practices, innovation, and long-term partnership with our clients.</p>
      </div>
    ),
    leadership: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Leadership Team</h3>
        <div style={styles.teamGrid}>
          {[
            { name: "Nilesh Kumawat", position: "Founder & CEO", logo: "https://via.placeholder.com/100" },
            { name: "Ayesha Sharma", position: "CTO", logo: "https://via.placeholder.com/100" },
            { name: "Rahul Verma", position: "Head of Design", logo: "https://via.placeholder.com/100" },
            { name: "Meera Desai", position: "VP, Marketing", logo: "https://via.placeholder.com/100" },
            { name: "Vikram Joshi", position: "Chief Product Officer", logo: "https://via.placeholder.com/100" },
          ].map((person, i) => (
            <div key={i} style={styles.card}>
              <img src={person.logo} alt={person.name} style={styles.avatar} />
              <h4>{person.name}</h4>
              <p style={styles.subText}>{person.position}</p>
            </div>
          ))}
        </div>
      </div>
    ),
    milestones: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Our Journey & Milestones</h3>
        <ul style={styles.timeline}>
          <li><strong>2020:</strong> Company founded in Jaipur, India.</li>
          <li><strong>2021:</strong> Launched first flagship product with 10,000+ users.</li>
          <li><strong>2022:</strong> Opened US & European offices; crossed $1M ARR.</li>
          <li><strong>2023:</strong> Received Top Innovation in SaaS award.</li>
          <li><strong>2024:</strong> Expanded to 15 countries with over 1 million users.</li>
          <li><strong>2025:</strong> Reached 200+ enterprise clients globally.</li>
        </ul>
      </div>
    ),
    culture: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Our Culture</h3>
        <p>We foster a collaborative, inclusive environment where creativity and accountability thrive.</p>
        <p>Our teams engage in quarterly off-site workshops, skill-share sessions, and community outreach programs focused on STEM education.</p>
        <ul style={styles.list}>
          <li>Professional development and leadership training</li>
          <li>Flexi-time, remote-friendly work policies</li>
          <li>Rigorous code reviews and design focus groups</li>
        </ul>
      </div>
    ),
    partners: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Our Partners</h3>
        <div style={styles.logoGrid}>
          {["https://via.placeholder.com/120x60", "https://via.placeholder.com/120x60", "https://via.placeholder.com/120x60"].map((url, idx) => (
            <img key={idx} src={url} alt={`Partner ${idx + 1}`} style={styles.partnerLogo} />
          ))}
        </div>
      </div>
    ),
    testimonials: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Client Testimonials</h3>
        {[
          { name: "John Doe, CTO at FinTech Corp", quote: "The team’s expertise transformed our legacy platform into a scalable, user-friendly solution." },
          { name: "Sarah Lee, VP Product at HealthTech Inc", quote: "Reliable, innovative, and always on-point. A partner for the long run." },
        ].map((t, i) => (
          <div key={i} style={styles.testimonialCard}>
            <p>"{t.quote}"</p>
            <p style={styles.subText}>— {t.name}</p>
          </div>
        ))}
      </div>
    ),
    careers: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Careers</h3>
        <p>We are scaling fast and hiring across multiple roles globally:</p>
        <ul style={styles.list}>
          <li>Full-Stack Engineers</li>
          <li>Product Managers</li>
          <li>UX/UI Designers</li>
          <li>DevOps Engineers</li>
          <li>Sales & Marketing</li>
        </ul>
        <button style={styles.primaryButton}>View Open Positions</button>
      </div>
    ),
    offices: (
      <div style={styles.cardBody}>
        <h3 style={styles.sectionTitle}>Our Offices Around the Globe</h3>
        <p><strong>Jaipur, India</strong> – Headquarters, R&D Center</p>
        <p><strong>New York, USA</strong> – Sales & Support</p>
        <p><strong>London, UK</strong> – Europe Operations</p>
        <div style={styles.mapPlaceholder}>[Interactive map would be here]</div>
      </div>
    ),
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.sidebar}>
          <h2 style={styles.title}>About Us</h2>
          <p style={styles.description}>Learn more about who we are and what we do</p>
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
  page: { fontFamily: "Segoe UI, sans-serif", backgroundColor: "#F5F5F5", minHeight: "100%", padding: "24px 20px", boxSizing: "border-box" },
  container: { maxWidth: "1400px", margin: "0 auto", backgroundColor: "#FFFFFF", display: "flex", flexWrap: "wrap", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" },
  sidebar: { flex: "1 1 280px", backgroundColor: "#ECEFF1", padding: "30px", borderRight: "1px solid #CFD8DC" },
  title: { fontSize: "24px", color: "#1A237E", marginBottom: "12px" },
  description: { fontSize: "14px", color: "#616161", marginBottom: "20px" },
  tabs: { display: "flex", flexDirection: "column", gap: "10px" },
  tab: { padding: "8px 12px", fontSize: "13px", cursor: "pointer", textAlign: "left", borderRadius: "6px", backgroundColor: "#fff", transition: "all 0.3s" },
  formSection: { flex: "2 1 1000px", padding: "40px", backgroundColor: "#FAFAFA" },
  formCard: { backgroundColor: "#fff", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", height: "570px", overflowY: "auto", display: "flex", flexDirection: "column" },
  cardBody: { display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", color: "#333" },
  sectionTitle: { fontSize: "18px", color: "#1A237E", marginBottom: "6px" },
  list: { paddingLeft: "20px", lineHeight: "1.6" },
  teamGrid: { display: "flex", flexWrap: "wrap", gap: "20px" },
  card: { flex: "1 1 220px", backgroundColor: "#FAFAFA", padding: "20px", borderRadius: "10px", border: "1px solid #E0E0E0", textAlign: "center" },
  avatar: { width: "80px", height: "80px", borderRadius: "50%", marginBottom: "12px" },
  subText: { fontSize: "13px", color: "#616161" },
  timeline: { paddingLeft: "20px", fontSize: "14px", lineHeight: "1.8" },
  logoGrid: { display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" },
  partnerLogo: { width: "120px", objectFit: "contain" },
  testimonialCard: { backgroundColor: "#FAFAFA", padding: "20px", borderRadius: "8px", marginBottom: "12px", border: "1px solid #E0E0E0" },
  mapPlaceholder: { height: "200px", backgroundColor: "#DDD", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#777" },
  primaryButton: { marginTop: "12px", padding: "10px 16px", backgroundColor: "#1A237E", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" },
};

export default AboutUs;
