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
      setOtpStatus(`Demo email OTP: ${otp}`);
      return;
    }

    if (!MOBILE_PATTERN.test(formData.mobile.trim())) {
      setErrors((current) => ({ ...current, mobile: "Enter a valid 10-digit mobile number first." }));
      setOtpStatus("Enter a valid mobile number to generate the mobile OTP.");
      return;
    }

    const otp = createOtp();
    setMobileOtpCode(otp);
    setOtpStatus(`Demo mobile OTP: ${otp}`);
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
    <section className="auth-screen-page">
      <div className="auth-screen-layout">
        <aside className="workspace-sidebar auth-screen-sidebar">
          <h1 className="sidebar-title">Signup</h1>
          <p className="sidebar-description">
            Same UI style as your current project, with a structured signup flow and validations.
          </p>

          <div className="sidebar-tabs">
            <button className="sidebar-tab active" type="button">
              Create Account
            </button>
            <button className="sidebar-tab" type="button" onClick={onShowLogin}>
              Go To Login
            </button>
            <button className="sidebar-tab" type="button" onClick={onBack}>
              Back Home
            </button>
          </div>

          <div className="sidebar-boost-card">
            <div className="sidebar-status">
              <h4>Verification Status</h4>
              <div className="status-feed">
                <p className="status-item status-info">
                  {otpStatus || "Use Send OTP for demo verification codes."}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="workspace-content auth-screen-content">
          <div className="info-card">
            <p>Fill out the signup form, or use temporary access to open the main project directly.</p>
          </div>

          <div className="content-card auth-signup-card">
            <form className="auth-signup-form" onSubmit={handleSubmit}>
              <div className="content-grid auth-signup-grid">
                <div className="tool-card">
                  <h3 className="tool-title">Personal Info</h3>

                  <label className="field-label" htmlFor="signup-full-name">Full Name</label>
                  <input
                    id="signup-full-name"
                    className={`auth-input ${errors.fullName ? "input-error" : ""}`}
                    type="text"
                    placeholder="Full Name"
                    value={formData.fullName}
                    onChange={(event) => setFieldValue("fullName", event.target.value)}
                  />
                  {errors.fullName ? <p className="error-text auth-field-error">{errors.fullName}</p> : null}

                  <label className="field-label" htmlFor="signup-username">Username</label>
                  <input
                    id="signup-username"
                    className={`auth-input ${errors.username ? "input-error" : ""}`}
                    type="text"
                    placeholder="Username"
                    value={formData.username}
                    onChange={(event) => setFieldValue("username", event.target.value)}
                  />
                  {errors.username ? <p className="error-text auth-field-error">{errors.username}</p> : null}

                  <label className="field-label" htmlFor="signup-dob">Date of Birth</label>
                  <input
                    id="signup-dob"
                    className={`auth-input ${errors.dateOfBirth ? "input-error" : ""}`}
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(event) => setFieldValue("dateOfBirth", event.target.value)}
                  />
                  {errors.dateOfBirth ? <p className="error-text auth-field-error">{errors.dateOfBirth}</p> : null}

                  <label className="field-label" htmlFor="signup-gender">Gender</label>
                  <select
                    id="signup-gender"
                    className={`auth-input ${errors.gender ? "input-error" : ""}`}
                    value={formData.gender}
                    onChange={(event) => setFieldValue("gender", event.target.value)}
                  >
                    <option value="">Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender ? <p className="error-text auth-field-error">{errors.gender}</p> : null}
                </div>

                <div className="tool-card">
                  <h3 className="tool-title">Account Info</h3>

                  <label className="field-label" htmlFor="signup-email">Email</label>
                  <div className="auth-inline-row">
                    <input
                      id="signup-email"
                      className={`auth-input ${errors.email ? "input-error" : ""}`}
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(event) => setFieldValue("email", event.target.value)}
                    />
                    <button className="auth-inline-button" type="button" onClick={() => sendOtp("email")}>
                      Send OTP
                    </button>
                  </div>
                  {errors.email ? <p className="error-text auth-field-error">{errors.email}</p> : null}

                  <label className="field-label" htmlFor="signup-password">Password</label>
                  <div className="auth-inline-row">
                    <input
                      id="signup-password"
                      className={`auth-input ${errors.password ? "input-error" : ""}`}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={formData.password}
                      onChange={(event) => setFieldValue("password", event.target.value)}
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

                  <label className="field-label" htmlFor="signup-confirm-password">Confirm Password</label>
                  <input
                    id="signup-confirm-password"
                    className={`auth-input ${errors.confirmPassword ? "input-error" : ""}`}
                    type="password"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={(event) => setFieldValue("confirmPassword", event.target.value)}
                  />
                  {errors.confirmPassword ? <p className="error-text auth-field-error">{errors.confirmPassword}</p> : null}

                  <label className="field-label" htmlFor="signup-alt-email">Alternate Email</label>
                  <input
                    id="signup-alt-email"
                    className={`auth-input ${errors.alternateEmail ? "input-error" : ""}`}
                    type="email"
                    placeholder="Alternate Email"
                    value={formData.alternateEmail}
                    onChange={(event) => setFieldValue("alternateEmail", event.target.value)}
                  />
                  {errors.alternateEmail ? <p className="error-text auth-field-error">{errors.alternateEmail}</p> : null}
                </div>

                <div className="tool-card">
                  <h3 className="tool-title">Contact Info</h3>

                  <label className="field-label" htmlFor="signup-mobile">Mobile Number</label>
                  <div className="auth-inline-row">
                    <input
                      id="signup-mobile"
                      className={`auth-input ${errors.mobile ? "input-error" : ""}`}
                      type="tel"
                      placeholder="Mobile Number"
                      value={formData.mobile}
                      onChange={(event) =>
                        setFieldValue("mobile", event.target.value.replace(/[^\d]/g, "").slice(0, 10))
                      }
                    />
                    <button className="auth-inline-button" type="button" onClick={() => sendOtp("mobile")}>
                      Send OTP
                    </button>
                  </div>
                  {errors.mobile ? <p className="error-text auth-field-error">{errors.mobile}</p> : null}

                  <label className="field-label" htmlFor="signup-security-question">Security Question</label>
                  <select
                    id="signup-security-question"
                    className={`auth-input ${errors.securityQuestion ? "input-error" : ""}`}
                    value={formData.securityQuestion}
                    onChange={(event) => setFieldValue("securityQuestion", event.target.value)}
                  >
                    <option value="">Security Question</option>
                    <option value="pet">Pet Name?</option>
                    <option value="school">First School?</option>
                    <option value="city">Birth City?</option>
                  </select>
                  {errors.securityQuestion ? <p className="error-text auth-field-error">{errors.securityQuestion}</p> : null}

                  <label className="field-label" htmlFor="signup-security-answer">Answer</label>
                  <input
                    id="signup-security-answer"
                    className={`auth-input ${errors.securityAnswer ? "input-error" : ""}`}
                    type="text"
                    placeholder="Answer"
                    value={formData.securityAnswer}
                    onChange={(event) => setFieldValue("securityAnswer", event.target.value)}
                  />
                  {errors.securityAnswer ? <p className="error-text auth-field-error">{errors.securityAnswer}</p> : null}

                  <label className="field-label" htmlFor="signup-referral">Referral Code</label>
                  <input
                    id="signup-referral"
                    className="auth-input"
                    type="text"
                    placeholder="Referral Code (Optional)"
                    value={formData.referralCode}
                    onChange={(event) => setFieldValue("referralCode", event.target.value)}
                  />
                </div>

                <div className="tool-card">
                  <h3 className="tool-title">Verification</h3>

                  <label className="field-label" htmlFor="signup-email-otp">Email OTP</label>
                  <input
                    id="signup-email-otp"
                    className={`auth-input ${errors.emailOtp ? "input-error" : ""}`}
                    type="text"
                    placeholder="Enter Email OTP"
                    value={formData.emailOtp}
                    onChange={(event) => setFieldValue("emailOtp", event.target.value.trim())}
                  />
                  {errors.emailOtp ? <p className="error-text auth-field-error">{errors.emailOtp}</p> : null}

                  <label className="field-label" htmlFor="signup-mobile-otp">Mobile OTP</label>
                  <input
                    id="signup-mobile-otp"
                    className={`auth-input ${errors.mobileOtp ? "input-error" : ""}`}
                    type="text"
                    placeholder="Enter Mobile OTP"
                    value={formData.mobileOtp}
                    onChange={(event) => setFieldValue("mobileOtp", event.target.value.trim())}
                  />
                  {errors.mobileOtp ? <p className="error-text auth-field-error">{errors.mobileOtp}</p> : null}

                  <label className="field-label" htmlFor="signup-captcha">Captcha</label>
                  <div className="auth-inline-row auth-captcha-row">
                    <div className="auth-captcha-box">{captchaCode}</div>
                    <button className="auth-inline-button" type="button" onClick={() => setCaptchaCode(buildCaptcha())}>
                      Refresh
                    </button>
                  </div>

                  <input
                    id="signup-captcha"
                    className={`auth-input ${errors.captchaInput ? "input-error" : ""}`}
                    type="text"
                    placeholder="Enter Captcha"
                    value={formData.captchaInput}
                    onChange={(event) => setFieldValue("captchaInput", event.target.value)}
                  />
                  {errors.captchaInput ? <p className="error-text auth-field-error">{errors.captchaInput}</p> : null}
                </div>
              </div>

              <div className="answer-section">
                <div className="answer-card-head">
                  <h3 className="tool-title">Agreement</h3>
                  <span className="answer-badge">Required</span>
                </div>
                <label className="auth-checkbox-row">
                  <input
                    type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={(event) => setFieldValue("agreeToTerms", event.target.checked)}
                  />
                  <span>I agree to Terms & Privacy</span>
                </label>
                {errors.agreeToTerms ? <p className="error-text auth-field-error">{errors.agreeToTerms}</p> : null}

                <div className="answer-box auth-terms-box">
                  <p>
                    This is a temporary frontend auth flow stored in local browser storage so you
                    can keep the same app style while adding login and signup pages.
                  </p>
                </div>

                {formError ? <p className="error-text auth-form-error">{formError}</p> : null}

                <div className="auth-action-row">
                  <button className="primary-button" type="submit">
                    Create Account
                  </button>
                  <button className="primary-button secondary-tone" type="button" onClick={onBypass}>
                    Continue Without Signup
                  </button>
                </div>
                <button className="primary-button" type="button" onClick={onShowLogin}>
                  Already Have Account? Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SignupPage;
