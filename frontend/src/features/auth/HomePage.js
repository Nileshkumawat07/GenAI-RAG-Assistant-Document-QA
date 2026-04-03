import React from "react";

function HomePage({ onLogin, onSignup, onContinue }) {
  return (
    <section className="landing-page">
      <div className="landing-hero">
        <div className="landing-copy">
          <p className="hero-kicker">AI Workspace Platform</p>
          <h1>One intelligent dashboard for documents, images, and real-time visual understanding.</h1>
          <p className="hero-text">
            Launch your assistant from a modern home page, onboard with polished login and signup
            flows, and move directly into the same GenAI workspace already powering your project.
          </p>

          <div className="hero-actions">
            <button className="hero-button hero-button-primary" type="button" onClick={onSignup}>
              Create account
            </button>
            <button className="hero-button hero-button-secondary" type="button" onClick={onLogin}>
              Login
            </button>
            <button className="hero-button hero-button-ghost" type="button" onClick={onContinue}>
              Temporary workspace access
            </button>
          </div>

          <div className="hero-proof-strip">
            <div className="proof-chip">RAG answers</div>
            <div className="proof-chip">Object detection</div>
            <div className="proof-chip">Image generation</div>
          </div>
        </div>

        <div className="landing-visual">
          <div className="visual-card visual-card-primary">
            <span className="visual-label">Live AI Suite</span>
            <strong>Document Q&A</strong>
            <p>Upload files, index them fast, and ask targeted questions with answer-ready output.</p>
          </div>
          <div className="visual-grid">
            <div className="visual-card">
              <span className="visual-label">Vision</span>
              <strong>Object Detection</strong>
              <p>Inspect an image, detect visible objects, and review counts with a clean summary.</p>
            </div>
            <div className="visual-card accent-card">
              <span className="visual-label">Creation</span>
              <strong>Image Generation</strong>
              <p>Turn prompts into generated visuals from the same product experience.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-highlights">
        <article className="highlight-card">
          <h3>Professional first impression</h3>
          <p>A proper landing page makes the app feel like a complete AI product instead of a raw tool screen.</p>
        </article>
        <article className="highlight-card">
          <h3>Simple onboarding flow</h3>
          <p>Users can sign up, log in, or use the temporary access button while backend auth is still pending.</p>
        </article>
        <article className="highlight-card">
          <h3>Same project, better flow</h3>
          <p>The original workspace remains intact and now sits behind a smoother front-door experience.</p>
        </article>
      </div>
    </section>
  );
}

export default HomePage;
