import React, { useEffect, useRef, useState } from "react";

import {
  checkFirebaseEmailVerification,
  resetFirebaseEmailVerification,
  resetFirebaseRecaptcha,
  sendFirebaseEmailVerification,
  sendFirebaseOtp,
  verifyFirebaseOtp,
} from "../../shared/firebase/phoneAuth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\d{10}$/;

function buildCaptcha() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
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

function formatFirebaseMessage(message, type) {
  const normalized = (message || "").toLowerCase();

  if (type === "email") {
    if (normalized.includes("auth/operation-not-allowed")) {
      return "Enable Email Link sign-in in Firebase Authentication > Email/Password.";
    }
    if (normalized.includes("auth/too-many-requests")) {
      return "Firebase temporarily blocked repeated email verification requests. Wait and try again.";
    }
  }

  if (type === "mobile") {
    if (normalized.includes("auth/too-many-requests")) {
      return "Firebase temporarily blocked repeated mobile OTP requests for this number. Wait and try again.";
    }
    if (normalized.includes("auth/invalid-verification-code") || normalized.includes("auth/code-expired")) {
      return "Wrong OTP.";
    }
  }

  return message || "Verification failed.";
}

function SignupPage({ onSubmit, onBack, onBypass, onShowLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [mobileVerifying, setMobileVerifying] = useState(false);
  const [mobileCooldown, setMobileCooldown] = useState(0);
  const [mobileConfirmation, setMobileConfirmation] = useState(null);
  const [captchaCode, setCaptchaCode] = useState(() => buildCaptcha());
  const [emailStatus, setEmailStatus] = useState("Waiting for email action.");
  const [mobileStatus, setMobileStatus] = useState("Waiting for mobile action.");
  const [errors, setErrors] = useState({});
  const recaptchaContainerId = useRef(`firebase-phone-recaptcha-${Math.random().toString(36).slice(2, 10)}`);
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
    mobileOtp: "",
    captchaInput: "",
    agreeToTerms: false,
  });

  const helperLines = [
    `Email: ${emailStatus}${emailCooldown > 0 ? ` Resend in ${emailCooldown}s.` : ""}`,
    `Mobile: ${mobileStatus}${mobileCooldown > 0 ? ` Resend in ${mobileCooldown}s.` : ""}`,
  ];

  useEffect(() => {
    return () => {
      resetFirebaseRecaptcha(recaptchaContainerId.current).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (emailCooldown <= 0 && mobileCooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setEmailCooldown((current) => (current > 0 ? current - 1 : 0));
      setMobileCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [emailCooldown, mobileCooldown]);

  const setFieldValue = (field, value) => {
    if (field === "email") {
      setEmailVerificationSent(false);
      setEmailVerified(false);
      setEmailStatus("Waiting for email action.");
      resetFirebaseEmailVerification().catch(() => {});
    }

    if (field === "mobile") {
      setMobileOtpSent(false);
      setMobileVerified(false);
      setMobileStatus("Waiting for mobile action.");
      setMobileConfirmation(null);
      resetFirebaseRecaptcha(recaptchaContainerId.current).catch(() => {});
    }

    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const sendOtp = async (type) => {
    if (type === "email") {
      if (emailCooldown > 0) {
        setEmailStatus(`Resend locked for ${emailCooldown}s.`);
        return;
      }

      if (!EMAIL_PATTERN.test(formData.email.trim())) {
        setErrors((current) => ({ ...current, email: "Enter a valid email before requesting verification." }));
        setEmailStatus("Enter a valid email address.");
        return;
      }

      try {
        await sendFirebaseEmailVerification(formData.email.trim(), formData.password);
        setErrors((current) => ({ ...current, email: "", emailVerification: "" }));
        setEmailVerificationSent(true);
        setEmailVerified(false);
        setEmailCooldown(30);
        setEmailStatus("Verification email sent. Open the email link, then click Verify.");
      } catch (error) {
        const message = formatFirebaseMessage(error.message, "email");
        setEmailStatus(message);
      }
      return;
    }

    if (mobileCooldown > 0) {
      setMobileStatus(`Resend locked for ${mobileCooldown}s.`);
      return;
    }

    if (!MOBILE_PATTERN.test(formData.mobile.trim())) {
      setErrors((current) => ({ ...current, mobile: "Enter a valid 10-digit mobile number first." }));
      setMobileStatus("Enter a valid mobile number.");
      return;
    }

    try {
      const response = await sendFirebaseOtp(
        `+91${formData.mobile.trim()}`,
        recaptchaContainerId.current,
      );
      setErrors((current) => ({ ...current, mobile: "", mobileOtp: "" }));
      setMobileConfirmation(response);
      setMobileOtpSent(true);
      setMobileVerified(false);
      setMobileCooldown(30);
      setMobileStatus("OTP sent.");
    } catch (error) {
      const message = formatFirebaseMessage(error.message, "mobile");
      setMobileOtpSent(false);
      setMobileConfirmation(null);
      setMobileStatus(message);
      resetFirebaseRecaptcha(recaptchaContainerId.current).catch(() => {});
    }
  };

  const checkEmailVerification = async () => {
    if (!EMAIL_PATTERN.test(formData.email.trim())) {
      setErrors((current) => ({ ...current, email: "Enter a valid email before verifying." }));
      setEmailStatus("Enter a valid email address.");
      return;
    }

    try {
      setEmailVerifying(true);
      await checkFirebaseEmailVerification(formData.email.trim());
      setEmailVerified(true);
      setErrors((current) => ({ ...current, emailVerification: "", email: "" }));
      setEmailStatus("Verified successfully.");
    } catch (error) {
      setEmailVerified(false);
      const message = formatFirebaseMessage(error.message, "email");
      setErrors((current) => ({ ...current, emailVerification: message }));
      setEmailStatus(message);
    } finally {
      setEmailVerifying(false);
    }
  };

  const verifyMobileOtp = async () => {
    if (!mobileConfirmation) {
      const message = "Send the mobile OTP first.";
      setErrors((current) => ({ ...current, mobileOtp: message }));
      setMobileStatus(message);
      return;
    }

    if (!formData.mobileOtp.trim()) {
      const message = "Enter the mobile OTP first.";
      setErrors((current) => ({ ...current, mobileOtp: message }));
      setMobileStatus(message);
      return;
    }

    try {
      setMobileVerifying(true);
      await verifyFirebaseOtp(mobileConfirmation, formData.mobileOtp.trim());
      setMobileVerified(true);
      setErrors((current) => ({ ...current, mobileOtp: "" }));
      setMobileStatus("Verified successfully.");
    } catch (error) {
      const message = formatFirebaseMessage(error.message, "mobile");
      setMobileVerified(false);
      setErrors((current) => ({ ...current, mobileOtp: message }));
      setMobileStatus(message);
    } finally {
      setMobileVerifying(false);
    }
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

    if (!emailVerificationSent) {
      nextErrors.emailVerification = "Send the verification email first.";
    }

    if (!emailVerified) {
      nextErrors.emailVerification = "Open the email link and click Verify.";
    }

    if (!mobileOtpSent) {
      nextErrors.mobileOtp = "Generate and enter the mobile OTP.";
    }

    if (!formData.mobileOtp.trim()) {
      nextErrors.mobileOtp = "Mobile OTP is required.";
    } else if (!mobileVerified) {
      nextErrors.mobileOtp = "Click Verify after entering the mobile OTP.";
    }

    if (formData.captchaInput.trim().toUpperCase() !== captchaCode) {
      nextErrors.captchaInput = "Captcha does not match.";
    }

    if (!formData.agreeToTerms) nextErrors.agreeToTerms = "You must accept the terms.";

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Please correct the highlighted signup fields.");
      return;
    }

    try {
      setFormError("");
      await checkFirebaseEmailVerification(formData.email.trim());

      if (!mobileConfirmation) {
        const message = "Please send the mobile OTP again.";
        setFormError(message);
        setErrors((current) => ({ ...current, mobileOtp: message }));
        return;
      }

      if (!mobileVerified) {
        const message = "Verify the mobile OTP before creating the account.";
        setFormError(message);
        setErrors((current) => ({ ...current, mobileOtp: message }));
        return;
      }

      setEmailVerified(true);
      setEmailStatus("Verified successfully.");
      setMobileStatus("Verified successfully.");
      onSubmit(formData);
    } catch (error) {
      const message = formatFirebaseMessage(error.message, "email");
      setFormError(message);
      setErrors((current) => ({ ...current, emailVerification: message }));
      setEmailStatus(message);
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
          <strong>Verification helper</strong>
          <div className="verification-helper-lines">
            {helperLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
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
              <button
                className="inline-field-button"
                type="button"
                onClick={() => sendOtp("email")}
                disabled={emailCooldown > 0}
              >
                {emailCooldown > 0 ? `Send in ${emailCooldown}s` : "Send Link"}
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
              <button
                className="inline-field-button"
                type="button"
                onClick={() => sendOtp("mobile")}
                disabled={mobileCooldown > 0}
              >
                {mobileCooldown > 0 ? `Send in ${mobileCooldown}s` : "Send OTP"}
              </button>
            </div>
            <div id={recaptchaContainerId.current} />

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

            <label className="auth-label" htmlFor="signup-mobile-otp">Mobile OTP</label>
            <div className="inline-action-field verification-row">
              <input
                id="signup-mobile-otp"
                className={`auth-input ${errors.mobileOtp ? "input-error" : ""}`}
                type="text"
                placeholder="Enter mobile OTP"
                value={formData.mobileOtp}
                onChange={(event) => {
                  setMobileVerified(false);
                  setFieldValue("mobileOtp", event.target.value.trim());
                }}
              />
              <button
                className="inline-field-button otp-verify-button"
                type="button"
                onClick={verifyMobileOtp}
                disabled={mobileVerified || mobileVerifying}
              >
                {mobileVerifying ? <span className="button-spinner" aria-hidden="true" /> : null}
                {mobileVerified ? "Verified" : "Verify"}
              </button>
            </div>

            <label className="auth-label" htmlFor="signup-email-verify-button">Email Verification</label>
            <div className="verification-button-row email-verification-row">
              <button
                id="signup-email-verify-button"
                className={`inline-field-button email-verify-button verification-button ${errors.emailVerification ? "input-error" : ""}`}
                type="button"
                onClick={checkEmailVerification}
                disabled={emailVerified || emailVerifying}
              >
                {emailVerifying ? <span className="button-spinner" aria-hidden="true" /> : null}
                {emailVerified ? "Verified" : "Verify"}
              </button>
            </div>

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
            <span>I agree to the terms, privacy policy, and verification flow.</span>
          </label>

          <div className="terms-panel">
            <h3>Privacy Terms & Agreement Instructions</h3>
            <p>
              This front-end flow stores users locally in your browser after successful verification
              so you can continue using the existing onboarding journey.
            </p>
          </div>

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
