import React from "react";

function HomePage({ onLogin, onSignup, onContinue }) {
  return (
    <section className="auth-home-page">
      <div className="auth-home-layout">
        <aside className="workspace-sidebar auth-screen-sidebar">
          <h1 className="sidebar-title">Assistant</h1>
          <p className="sidebar-description">
            Same project UI, now with a first page for login, signup, and temporary access.
          </p>

          <div className="sidebar-tabs">
            <button className="sidebar-tab active" type="button" onClick={onLogin}>
              Login
            </button>
            <button className="sidebar-tab" type="button" onClick={onSignup}>
              Signup
            </button>
            <button className="sidebar-tab" type="button" onClick={onContinue}>
              Temporary Access
            </button>
          </div>

          <div className="sidebar-boost-card">
            <div className="sidebar-status">
              <h4>Platform Access</h4>
              <div className="status-feed">
                <p className="status-item status-info">Document retrieval ready.</p>
                <p className="status-item status-info">Object detection ready.</p>
                <p className="status-item status-info">Image generation ready.</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="auth-home-content">
          <div className="info-card">
            <p>Start from home, then continue to the same GenAI workspace already in your project.</p>
          </div>

          <div className="content-card auth-home-card">
            <div className="content-grid">
              <div className="tool-card">
                <h3 className="tool-title">Login</h3>
                <p className="tool-copy">Use stored account credentials to enter the workspace.</p>
                <div className="placeholder-box">
                  <strong>Existing Users</strong>
                  <p>Sign in with your email or username and continue to the project workspace.</p>
                </div>
                <button className="primary-button" type="button" onClick={onLogin}>
                  Open Login
                </button>
              </div>

              <div className="tool-card">
                <h3 className="tool-title">Signup</h3>
                <p className="tool-copy">Create an account with validations and demo verification.</p>
                <div className="placeholder-box">
                  <strong>New Users</strong>
                  <p>Fill the signup form first, then move into the same assistant workspace.</p>
                </div>
                <button className="primary-button" type="button" onClick={onSignup}>
                  Open Signup
                </button>
              </div>
            </div>

            <div className="answer-section">
              <div className="answer-card-head">
                <h3 className="tool-title">Quick Access</h3>
                <span className="answer-badge">Guest</span>
              </div>
              <div className="answer-box">
                <p>Use the temporary button if you want to reach the main project without auth.</p>
              </div>
              <button className="primary-button secondary-tone auth-home-guest-button" type="button" onClick={onContinue}>
                Continue To Main Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomePage;
