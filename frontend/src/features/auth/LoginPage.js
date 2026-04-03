import React, { useState } from "react";

function LoginPage({ onSubmit, onBack, onBypass, onShowSignup, initialError = "" }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(initialError);

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
    <section className="auth-page">
      <div className="auth-showcase">
        <p className="hero-kicker">Welcome Back</p>
        <h1>Return to your AI command center.</h1>
        <p>
          Log in with the account you created on this device, or use the temporary access button to
          jump straight into the main workspace while auth is only local.
        </p>
        <div className="auth-showcase-points">
          <span>Fast access</span>
          <span>Clean validation</span>
          <span>Local demo auth</span>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-head">
          <div className="login-header-spacer" aria-hidden="true" />
        </div>

        <label className="auth-label" htmlFor="login-identifier">
          Email or Username
        </label>
        <input
          id="login-identifier"
          className={`auth-input ${errors.identifier ? "input-error" : ""}`}
          type="text"
          placeholder="you@example.com or username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />

        <label className="auth-label" htmlFor="login-password">
          Password
        </label>
        <div className="password-shell">
          <input
            id="login-password"
            className={`auth-input ${errors.password ? "input-error" : ""}`}
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {formError ? <p className="form-error-banner">{formError}</p> : null}

        <button className="auth-primary-button" type="submit">
          Login
        </button>
        <button className="auth-secondary-button" type="button" onClick={onBypass}>
          Continue without login
        </button>

        <div className="auth-login-fill">
          <div className="auth-login-fill-card">
            <p className="auth-login-fill-eyebrow">Inside the workspace</p>
            <h3>Launch the full AI suite right after sign in.</h3>
            <p>
              Open document retrieval, object detection, and image generation from the same
              command center without changing products or pages.
            </p>
          </div>

          <div className="auth-login-fill-grid auth-login-support-grid">
            <div className="auth-login-mini-card">
              <strong>Document Q&amp;A</strong>
              <span>Upload files, ask focused questions, and get fast answer-ready output.</span>
            </div>
            <div className="auth-login-mini-card">
              <strong>Object Detection</strong>
              <span>Inspect uploaded images and review detected objects in one clean workspace.</span>
            </div>
            <div className="auth-login-mini-card">
              <strong>Image Generation</strong>
              <span>Turn prompts into visuals without leaving the same product flow.</span>
            </div>
            <div className="auth-login-mini-card">
              <strong>Guest Access Ready</strong>
              <span>Need speed first? Jump in directly with temporary access and explore now.</span>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

export default LoginPage;
