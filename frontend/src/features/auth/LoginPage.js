import React, { useState } from "react";

function LoginPage({ onSubmit, onBack, onBypass, onShowSignup }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const validate = () => {
    const nextErrors = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Enter your email or username.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Fix the highlighted login fields.");
      return;
    }

    try {
      setFormError("");
      onSubmit({ identifier, password });
    } catch (error) {
      setFormError(error.message);
    }
  };

  return (
    <section className="auth-screen-page">
      <div className="auth-screen-layout">
        <aside className="workspace-sidebar auth-screen-sidebar">
          <h1 className="sidebar-title">Login</h1>
          <p className="sidebar-description">
            Access the assistant with the same project styling and layout.
          </p>

          <div className="sidebar-tabs">
            <button className="sidebar-tab active" type="button">
              Sign In
            </button>
            <button className="sidebar-tab" type="button" onClick={onShowSignup}>
              Go To Signup
            </button>
            <button className="sidebar-tab" type="button" onClick={onBack}>
              Back Home
            </button>
          </div>

          <div className="sidebar-boost-card">
            <div className="sidebar-status">
              <h4>Login Notes</h4>
              <div className="status-feed">
                <p className="status-item status-info">Use email or username.</p>
                <p className="status-item status-info">Accounts are stored locally in your browser.</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="workspace-content auth-screen-content">
          <div className="info-card">
            <p>Login to continue into the workspace, or use temporary access to skip auth.</p>
          </div>

          <div className="content-card auth-form-card">
            <form className="auth-form-stack" onSubmit={handleSubmit}>
              <div className="tool-card">
                <h3 className="tool-title">Account Access</h3>
                <p className="tool-copy">Enter your credentials to continue.</p>

                <label className="field-label" htmlFor="login-identifier">
                  Email or Username
                </label>
                <input
                  id="login-identifier"
                  className={`auth-input ${errors.identifier ? "input-error" : ""}`}
                  type="text"
                  placeholder="Enter email or username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
                {errors.identifier ? <p className="error-text auth-field-error">{errors.identifier}</p> : null}

                <label className="field-label" htmlFor="login-password">
                  Password
                </label>
                <div className="auth-inline-row">
                  <input
                    id="login-password"
                    className={`auth-input ${errors.password ? "input-error" : ""}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="auth-inline-button"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password ? <p className="error-text auth-field-error">{errors.password}</p> : null}

                {formError ? <p className="error-text auth-form-error">{formError}</p> : null}

                <button className="primary-button" type="submit">
                  Login
                </button>
                <button className="primary-button secondary-tone" type="button" onClick={onBypass}>
                  Continue Without Login
                </button>
              </div>

              <div className="answer-section">
                <div className="answer-card-head">
                  <h3 className="tool-title">Need an account?</h3>
                  <span className="answer-badge">Signup</span>
                </div>
                <div className="answer-box">
                  <p>Create a new account first if you have not signed up on this browser yet.</p>
                </div>
                <button className="primary-button" type="button" onClick={onShowSignup}>
                  Go To Signup
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
