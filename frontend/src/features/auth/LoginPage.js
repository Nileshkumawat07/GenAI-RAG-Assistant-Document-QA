import React, { useState } from "react";

function LoginPage({ onSubmit, onBack, onShowSignup, initialError = "", t = (key, fallback) => fallback || key }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Fix the highlighted login fields.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      await onSubmit({ identifier, password });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-showcase">
        <p className="hero-kicker">{t("welcome_back", "Welcome Back")}</p>
        <h1>Return to your AI command center.</h1>
        <p>
          Log in with the account you created from the shared backend and continue into the
          workspace with your saved profile.
        </p>
        <div className="auth-showcase-points">
          <span>{t("fast_access", "Fast access")}</span>
          <span>{t("clean_validation", "Clean validation")}</span>
          <span>{t("mysql_backed_auth", "MySQL-backed auth")}</span>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-head">
          <div className="login-header-spacer" aria-hidden="true" />
        </div>

        <label className="auth-label" htmlFor="login-identifier">
          {t("email_or_username", "Email or Username")}
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
          {t("password", "Password")}
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
            {showPassword ? t("hide", "Hide") : t("show", "Show")}
          </button>
        </div>

        {formError ? <p className="form-error-banner">{formError}</p> : null}

        <button className="auth-primary-button" type="submit" disabled={submitting}>
          {submitting ? t("logging_in", "Logging in...") : t("login", "Login")}
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
              <strong>{t("document_qa", "Document Q&A")}</strong>
              <span>Upload files, ask focused questions, and get fast answer-ready output.</span>
            </div>
            <div className="auth-login-mini-card">
              <strong>{t("object_detection", "Object Detection")}</strong>
              <span>Inspect uploaded images and review detected objects in one clean workspace.</span>
            </div>
            <div className="auth-login-mini-card">
              <strong>{t("image_generation", "Image Generation")}</strong>
              <span>Turn prompts into visuals without leaving the same product flow.</span>
            </div>
            <div className="auth-login-mini-card">
              <strong>{t("account_sync", "Account Sync")}</strong>
              <span>Open the same saved account details and workspace entry from any supported session.</span>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

export default LoginPage;
