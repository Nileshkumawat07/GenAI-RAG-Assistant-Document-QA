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
          <div>
            <p className="auth-eyebrow">Login</p>
            <h2>Sign in</h2>
          </div>
          <button className="text-link-button" type="button" onClick={onBack}>
            Back home
          </button>
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
        {errors.identifier ? <p className="field-error">{errors.identifier}</p> : null}

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
        {errors.password ? <p className="field-error">{errors.password}</p> : null}

        {formError ? <p className="form-error-banner">{formError}</p> : null}

        <button className="auth-primary-button" type="submit">
          Login
        </button>
        <button className="auth-secondary-button" type="button" onClick={onBypass}>
          Continue without login
        </button>

        <p className="auth-footnote">
          Need an account?{" "}
          <button className="inline-text-button" type="button" onClick={onShowSignup}>
            Create one here
          </button>
        </p>
      </form>
    </section>
  );
}

export default LoginPage;
