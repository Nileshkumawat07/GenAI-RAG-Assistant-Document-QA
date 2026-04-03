import React, { useState } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\d{10}$/;

function buildCaptcha() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return 0;
  }

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age;
}

function SignupPage({ onSubmit, onBack, onBypass, onShowLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [mobileOtpCode, setMobileOtpCode] = useState("");
  const [captchaCode, setCaptchaCode] = useState(() => buildCaptcha());
  const [otpStatus, setOtpStatus] = useState("");
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    password: "",
    confirmPassword: "",
    alternateEmail: "",
    mobile: "",
    securityQuestion: "",
    securityAnswer: "",
    referralCode: "",
    emailOtp: "",
    mobileOtp: "",
    captchaInput: "",
    agreeToTerms: false,
  });

  const helperStatus =
    otpStatus || "Use Send OTP to generate temporary verification codes for this local demo.";

  const setFieldValue = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const sendOtp = (type) => {
    if (type === "email") {
      if (!EMAIL_PATTERN.test(formData.email.trim())) {
        setErrors((current) => ({ ...current, email: "Enter a valid email before requesting OTP." }));
        setOtpStatus("Enter a valid email to generate the email OTP.");
        return;
      }

      const otp = createOtp();
      setEmailOtpCode(otp);
      setOtpStatus(`Demo email OTP generated: ${otp}`);
      return;
    }

    if (!MOBILE_PATTERN.test(formData.mobile.trim())) {
      setErrors((current) => ({ ...current, mobile: "Enter a valid 10-digit mobile number first." }));
      setOtpStatus("Enter a valid mobile number to generate the mobile OTP.");
      return;
    }

    const otp = createOtp();
    setMobileOtpCode(otp);
    setOtpStatus(`Demo mobile OTP generated: ${otp}`);
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!formData.username.trim()) nextErrors.username = "Username is required.";
    if (formData.username.trim().length < 4) nextErrors.username = "Username must be at least 4 characters.";
    if (!formData.dateOfBirth) {
      nextErrors.dateOfBirth = "Date of birth is required.";
    } else if (calculateAge(formData.dateOfBirth) < 13) {
      nextErrors.dateOfBirth = "User must be at least 13 years old.";
    }

    if (!formData.gender) nextErrors.gender = "Select a gender.";
    if (!EMAIL_PATTERN.test(formData.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (formData.alternateEmail.trim() && !EMAIL_PATTERN.test(formData.alternateEmail.trim())) {
      nextErrors.alternateEmail = "Alternate email is invalid.";
    }

    if (!formData.password) {
      nextErrors.password = "Password is required.";
    } else if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(formData.password)) {
      nextErrors.password = "Use 8+ characters with upper, lower, and a number.";
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (!MOBILE_PATTERN.test(formData.mobile.trim())) {
      nextErrors.mobile = "Enter a valid 10-digit mobile number.";
    }

    if (!formData.securityQuestion) nextErrors.securityQuestion = "Choose a security question.";
    if (!formData.securityAnswer.trim()) nextErrors.securityAnswer = "Security answer is required.";

    if (!emailOtpCode) {
      nextErrors.emailOtp = "Generate and enter the email OTP.";
    } else if (formData.emailOtp.trim() !== emailOtpCode) {
      nextErrors.emailOtp = "Email OTP does not match.";
    }

    if (!mobileOtpCode) {
      nextErrors.mobileOtp = "Generate and enter the mobile OTP.";
    } else if (formData.mobileOtp.trim() !== mobileOtpCode) {
      nextErrors.mobileOtp = "Mobile OTP does not match.";
    }

    if (formData.captchaInput.trim().toUpperCase() !== captchaCode) {
      nextErrors.captchaInput = "Captcha does not match.";
    }

    if (!formData.agreeToTerms) nextErrors.agreeToTerms = "You must accept the terms.";

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Please correct the highlighted signup fields.");
      return;
    }

    try {
      setFormError("");
      onSubmit(formData);
    } catch (error) {
      setFormError(error.message);
    }
  };

  return (
    <section className="auth-page signup-page">
      <div className="auth-showcase signup-showcase">
        <h1>Start with a signup flow that feels production-ready.</h1>
        <p>
          This keeps the multi-section feel from your shared signup page, but matches the UI of
          this AI project and adds proper front-end validation throughout.
        </p>
        <div className="auth-helper-card">
          <strong>Demo verification helper</strong>
          <p>{helperStatus}</p>
        </div>
      </div>

      <form className="signup-card" onSubmit={handleSubmit}>
        <div className="auth-card-head">
          <div className="signup-header-spacer" aria-hidden="true" />
        </div>

        <div className="signup-grid">
          <div className="signup-section">
            <h3>Personal Info</h3>

            <label className="auth-label" htmlFor="signup-full-name">Full Name</label>
            <input
              id="signup-full-name"
              className={`auth-input ${errors.fullName ? "input-error" : ""}`}
              type="text"
              placeholder="Enter full name"
              value={formData.fullName}
              onChange={(event) => setFieldValue("fullName", event.target.value)}
            />

            <label className="auth-label" htmlFor="signup-username">Username</label>
            <input
              id="signup-username"
              className={`auth-input ${errors.username ? "input-error" : ""}`}
              type="text"
              placeholder="Choose a username"
              value={formData.username}
              onChange={(event) => setFieldValue("username", event.target.value)}
            />

            <label className="auth-label" htmlFor="signup-dob">Date of Birth</label>
            <input
              id="signup-dob"
              className={`auth-input ${errors.dateOfBirth ? "input-error" : ""}`}
              type="date"
              value={formData.dateOfBirth}
              onChange={(event) => setFieldValue("dateOfBirth", event.target.value)}
            />

            <label className="auth-label" htmlFor="signup-gender">Gender</label>
            <select
              id="signup-gender"
              className={`auth-input ${errors.gender ? "input-error" : ""}`}
              value={formData.gender}
              onChange={(event) => setFieldValue("gender", event.target.value)}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="signup-section">
            <h3>Account Info</h3>

            <label className="auth-label" htmlFor="signup-email">Email</label>
            <div className="inline-action-field">
              <input
                id="signup-email"
                className={`auth-input ${errors.email ? "input-error" : ""}`}
                type="email"
                placeholder="name@example.com"
              value={formData.email}
              onChange={(event) => setFieldValue("email", event.target.value)}
            />
              <button className="inline-field-button" type="button" onClick={() => sendOtp("email")}>
                Send OTP
              </button>
            </div>

            <label className="auth-label" htmlFor="signup-password">Password</label>
            <div className="password-shell">
              <input
                id="signup-password"
                className={`auth-input ${errors.password ? "input-error" : ""}`}
                type={showPassword ? "text" : "password"}
                placeholder="Create password"
                value={formData.password}
                onChange={(event) => setFieldValue("password", event.target.value)}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <label className="auth-label" htmlFor="signup-confirm-password">Confirm Password</label>
            <input
              id="signup-confirm-password"
              className={`auth-input ${errors.confirmPassword ? "input-error" : ""}`}
              type="password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(event) => setFieldValue("confirmPassword", event.target.value)}
            />

            <label className="auth-label" htmlFor="signup-alt-email">Alternate Email</label>
            <input
              id="signup-alt-email"
              className={`auth-input ${errors.alternateEmail ? "input-error" : ""}`}
              type="email"
              placeholder="Optional alternate email"
              value={formData.alternateEmail}
              onChange={(event) => setFieldValue("alternateEmail", event.target.value)}
            />
          </div>

          <div className="signup-section">
            <h3>Contact Info</h3>

            <label className="auth-label" htmlFor="signup-mobile">Mobile Number</label>
            <div className="inline-action-field">
              <input
                id="signup-mobile"
                className={`auth-input ${errors.mobile ? "input-error" : ""}`}
                type="tel"
                placeholder="10-digit mobile number"
              value={formData.mobile}
              onChange={(event) => setFieldValue("mobile", event.target.value.replace(/[^\d]/g, "").slice(0, 10))}
            />
              <button className="inline-field-button" type="button" onClick={() => sendOtp("mobile")}>
                Send OTP
              </button>
            </div>

            <label className="auth-label" htmlFor="signup-security-question">Security Question</label>
            <select
              id="signup-security-question"
              className={`auth-input ${errors.securityQuestion ? "input-error" : ""}`}
              value={formData.securityQuestion}
              onChange={(event) => setFieldValue("securityQuestion", event.target.value)}
            >
              <option value="">Choose security question</option>
              <option value="pet">What is your pet name?</option>
              <option value="school">What was your first school?</option>
              <option value="city">Which city were you born in?</option>
            </select>

            <label className="auth-label" htmlFor="signup-security-answer">Answer</label>
            <input
              id="signup-security-answer"
              className={`auth-input ${errors.securityAnswer ? "input-error" : ""}`}
              type="text"
              placeholder="Enter your answer"
              value={formData.securityAnswer}
              onChange={(event) => setFieldValue("securityAnswer", event.target.value)}
            />

            <label className="auth-label" htmlFor="signup-referral">Referral Code</label>
            <input
              id="signup-referral"
              className="auth-input"
              type="text"
              placeholder="Optional referral code"
              value={formData.referralCode}
              onChange={(event) => setFieldValue("referralCode", event.target.value)}
            />
          </div>

          <div className="signup-section">
            <h3>Verification</h3>

            <label className="auth-label" htmlFor="signup-email-otp">Email OTP</label>
            <input
              id="signup-email-otp"
              className={`auth-input ${errors.emailOtp ? "input-error" : ""}`}
              type="text"
              placeholder="Enter email OTP"
              value={formData.emailOtp}
              onChange={(event) => setFieldValue("emailOtp", event.target.value.trim())}
            />

            <label className="auth-label" htmlFor="signup-mobile-otp">Mobile OTP</label>
            <input
              id="signup-mobile-otp"
              className={`auth-input ${errors.mobileOtp ? "input-error" : ""}`}
              type="text"
              placeholder="Enter mobile OTP"
              value={formData.mobileOtp}
              onChange={(event) => setFieldValue("mobileOtp", event.target.value.trim())}
            />

            <label className="auth-label" htmlFor="signup-captcha">Captcha</label>
            <div className="captcha-row">
              <div className="captcha-box">{captchaCode}</div>
              <button
                className="text-link-button small-link-button"
                type="button"
                onClick={() => setCaptchaCode(buildCaptcha())}
              >
                Refresh
              </button>
            </div>
            <input
              id="signup-captcha"
              className={`auth-input ${errors.captchaInput ? "input-error" : ""}`}
              type="text"
              placeholder="Enter captcha"
              value={formData.captchaInput}
              onChange={(event) => setFieldValue("captchaInput", event.target.value)}
            />
          </div>
        </div>

        <div className="signup-footer">
          <label className="terms-check">
            <input
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={(event) => setFieldValue("agreeToTerms", event.target.checked)}
            />
            <span>I agree to the terms, privacy policy, and local demo verification flow.</span>
          </label>

          <div className="terms-panel">
            <h3>Privacy Terms & Agreement Instructions</h3>
            <p>
              This front-end flow stores demo users locally in your browser so you can experience a
              realistic onboarding journey before wiring real backend authentication.
            </p>
          </div>

          {formError ? <p className="form-error-banner">{formError}</p> : null}

          <div className="signup-actions">
            <button className="auth-primary-button" type="submit">
              Create Account
            </button>
            <button className="auth-secondary-button" type="button" onClick={onBypass}>
              Continue without signup
            </button>
          </div>

        </div>
      </form>
    </section>
  );
}

export default SignupPage;
