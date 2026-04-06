import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  changePassword,
  deleteAccount,
  downloadAccountDataPdf,
  updateEmail,
  updateMobile,
  updateUsername,
} from "../auth/authApi";
import {
  authorizeLinkedProvider,
  listLinkedProviders,
  unlinkProvider,
} from "../auth/linkedProviderApi";
import { cancelSubscription, downloadInvoicePdf, listInvoices } from "./billingApi";
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
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

function buildCaptcha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let index = 0; index < 6; index += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

function createDefaultStoredSettings() {
  return {
    preferences: {
      theme: "Light",
      language: "English",
      font: "Segoe UI",
    },
    privacy: {
      allowAdPersonalization: false,
      enableCookieTracking: true,
    },
    notifications: {
      emailAlerts: true,
      smsNotifications: false,
      inAppAlerts: true,
    },
    region: {
      timezone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      country: "India",
    },
    linked: {
      google: { linked: false, locked: false, email: "", displayName: "", providerId: "", linkedAt: "" },
      facebook: { linked: false, locked: false, email: "", displayName: "", providerId: "", linkedAt: "" },
      linkedin: { linked: false, locked: false, email: "", displayName: "", providerId: "", linkedAt: "" },
    },
    security: {
      twoStepEnabled: false,
    },
    activity: [],
  };
}

function normalizeStoredSettings(rawSettings, currentUser) {
  const defaults = createDefaultStoredSettings();
  const merged = {
    ...defaults,
    ...(rawSettings || {}),
    linked: { ...defaults.linked },
  };

  ["google", "facebook", "linkedin"].forEach((providerKey) => {
    const rawProvider = rawSettings?.linked?.[providerKey];
    if (typeof rawProvider === "boolean") {
      merged.linked[providerKey] = {
        ...defaults.linked[providerKey],
        linked: rawProvider,
      };
    } else {
      merged.linked[providerKey] = {
        ...defaults.linked[providerKey],
        ...(rawProvider || {}),
      };
    }
  });

  const gmailLinked = /@gmail\.com$/i.test(currentUser?.email || "");
  if (gmailLinked) {
    merged.linked.google = {
      ...merged.linked.google,
      linked: true,
      locked: true,
      email: merged.linked.google.email || currentUser.email || "",
      displayName: merged.linked.google.displayName || currentUser?.fullName || currentUser?.name || "",
      providerId: "google.com",
      linkedAt: merged.linked.google.linkedAt || currentUser?.createdAt || new Date().toISOString(),
    };
  } else {
    merged.linked.google = {
      ...merged.linked.google,
      locked: false,
    };
  }

  return merged;
}

function formatLinkedDate(value) {
  if (!value) return "Recently linked";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently linked";
  }
}

function ProviderIcon({ providerKey }) {
  const commonProps = { width: 22, height: 22, viewBox: "0 0 24 24", ariaHidden: "true" };

  if (providerKey === "google") {
    return (
      <svg {...commonProps}>
        <path fill="#4285F4" d="M21.8 12.23c0-.76-.07-1.49-.19-2.18H12v4.13h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.41 3.04-7.59Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.3-2.56c-.91.61-2.07.98-3.31.98-2.54 0-4.69-1.72-5.46-4.03H3.13v2.64A9.98 9.98 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.54 13.95A5.98 5.98 0 0 1 6.24 12c0-.68.12-1.34.3-1.95V7.41H3.13A9.97 9.97 0 0 0 2 12c0 1.61.39 3.13 1.13 4.59l3.41-2.64Z" />
        <path fill="#EA4335" d="M12 6.02c1.47 0 2.79.5 3.83 1.49l2.87-2.87C16.95 2.98 14.69 2 12 2A9.98 9.98 0 0 0 3.13 7.41l3.41 2.64C7.31 7.74 9.46 6.02 12 6.02Z" />
      </svg>
    );
  }

  if (providerKey === "facebook") {
    return (
      <svg {...commonProps}>
        <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.86v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.52-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.39A12 12 0 0 0 24 12Z" />
        <path fill="#FFFFFF" d="M16.65 15.47 17.18 12h-3.32V9.75c0-.95.46-1.87 1.95-1.87h1.51V4.93s-1.37-.23-2.68-.23c-2.73 0-4.52 1.66-4.52 4.66V12H7.08v3.47h3.04v8.39c.61.09 1.24.14 1.88.14s1.27-.05 1.88-.14v-8.39h2.77Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.27 2.38 4.27 5.47v6.27ZM5.32 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.1 20.45H3.54V9H7.1v11.45Z"
      />
    </svg>
  );
}

function createActivityEntry(text) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
  };
}

function SettingsPanel({ activeTab, currentUser, onUserUpdate, onAccountDeleted }) {
  const [accountTab, setAccountTab] = useState("personalInfo");
  const [securityTab, setSecurityTab] = useState("password");
  const [preferencesTab, setPreferencesTab] = useState("theme");
  const [feedback, setFeedback] = useState({
    type: "info",
    text: "Update your settings safely from this panel.",
  });
  const [storedSettings, setStoredSettings] = useState(createDefaultStoredSettings);

  const [usernameForm, setUsernameForm] = useState({ newUsername: "", otp: "", captchaInput: "" });
  const [usernameCaptcha, setUsernameCaptcha] = useState(() => buildCaptcha());
  const [usernameOtpConfirmation, setUsernameOtpConfirmation] = useState(null);
  const [usernameOtpVerified, setUsernameOtpVerified] = useState(false);
  const [usernameOtpCooldown, setUsernameOtpCooldown] = useState(0);
  const [usernameOtpSending, setUsernameOtpSending] = useState(false);
  const [usernameOtpVerifying, setUsernameOtpVerifying] = useState(false);
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    currentPassword: "",
    mobileOtp: "",
    captchaInput: "",
  });
  const [emailCaptcha, setEmailCaptcha] = useState(() => buildCaptcha());
  const [emailMobileConfirmation, setEmailMobileConfirmation] = useState(null);
  const [emailMobileVerified, setEmailMobileVerified] = useState(false);
  const [emailMobileCooldown, setEmailMobileCooldown] = useState(0);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailLinkSending, setEmailLinkSending] = useState(false);
  const [emailLinkCooldown, setEmailLinkCooldown] = useState(0);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  const [mobileForm, setMobileForm] = useState({
    newMobile: "",
    currentOtp: "",
    newOtp: "",
    captchaInput: "",
  });
  const [mobileCaptcha, setMobileCaptcha] = useState(() => buildCaptcha());
  const [mobileCurrentConfirmation, setMobileCurrentConfirmation] = useState(null);
  const [mobileCurrentVerified, setMobileCurrentVerified] = useState(false);
  const [mobileCurrentCooldown, setMobileCurrentCooldown] = useState(0);
  const [mobileNewConfirmation, setMobileNewConfirmation] = useState(null);
  const [mobileNewVerified, setMobileNewVerified] = useState(false);
  const [mobileNewCooldown, setMobileNewCooldown] = useState(0);
  const [mobileSaving, setMobileSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    otp: "",
    captchaInput: "",
  });
  const [passwordCaptcha, setPasswordCaptcha] = useState(() => buildCaptcha());
  const [passwordOtpConfirmation, setPasswordOtpConfirmation] = useState(null);
  const [passwordOtpVerified, setPasswordOtpVerified] = useState(false);
  const [passwordOtpCooldown, setPasswordOtpCooldown] = useState(0);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [linkedForms, setLinkedForms] = useState({
    google: { currentPassword: "" },
    facebook: { currentPassword: "" },
    linkedin: { currentPassword: "" },
  });
  const [linkedSaving, setLinkedSaving] = useState({
    google: false,
    facebook: false,
    linkedin: false,
  });

  const [resetPassword, setResetPassword] = useState("");
  const [billingInvoices, setBillingInvoices] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingActionLoading, setBillingActionLoading] = useState("");
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [privacyActionLoading, setPrivacyActionLoading] = useState("");
  const [privacyExportPassword, setPrivacyExportPassword] = useState("");
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deleteReadConfirmed, setDeleteReadConfirmed] = useState(false);

  const usernameRecaptchaId = useRef(`settings-username-mobile-${Math.random().toString(36).slice(2, 10)}`);
  const emailRecaptchaId = useRef(`settings-email-mobile-${Math.random().toString(36).slice(2, 10)}`);
  const mobileCurrentRecaptchaId = useRef(`settings-mobile-current-${Math.random().toString(36).slice(2, 10)}`);
  const mobileNewRecaptchaId = useRef(`settings-mobile-new-${Math.random().toString(36).slice(2, 10)}`);
  const passwordRecaptchaId = useRef(`settings-password-mobile-${Math.random().toString(36).slice(2, 10)}`);

  const storageKey = useMemo(
    () => (currentUser?.id ? `genai_workspace_settings_${currentUser.id}` : null),
    [currentUser?.id]
  );

  const profileName = currentUser?.fullName || currentUser?.name || "User";
  const profileEmail = currentUser?.email || "";
  const profileUsername = currentUser?.username || "user_profile";
  const profileAlternateEmail = currentUser?.alternateEmail || "Not provided";
  const profileMobile = currentUser?.mobile || "Not provided";
  const profileDateOfBirth = currentUser?.dateOfBirth || "Not provided";
  const profileGender = currentUser?.gender || "Not provided";
  const profileSecurityQuestion = currentUser?.securityQuestion || "Not provided";
  const profileSecurityAnswer = currentUser?.securityAnswer || "Not provided";
  const profileReferralCode = currentUser?.referralCode || "Not provided";
  const subscriptionPlanName = currentUser?.subscriptionPlanName || "Free Member";
  const subscriptionStatus = currentUser?.subscriptionStatus || "free";
  const subscriptionAmount = currentUser?.subscriptionAmount;
  const subscriptionCurrency = currentUser?.subscriptionCurrency || "INR";
  const subscriptionBillingCycle = currentUser?.subscriptionBillingCycle || "monthly";
  const subscriptionActivatedAt = currentUser?.subscriptionActivatedAt;
  const subscriptionExpiresAt = currentUser?.subscriptionExpiresAt;
  const subscriptionPriceLabel =
    subscriptionAmount != null
      ? `${new Intl.NumberFormat("en-IN", { style: "currency", currency: subscriptionCurrency, maximumFractionDigits: 0 }).format(subscriptionAmount / 100)} / ${subscriptionBillingCycle}`
      : "Free access";
  const latestInvoice = billingInvoices[0] || null;
  const activityEntries = storedSettings.activity || [];

  useEffect(() => {
    if (!storageKey) {
      setStoredSettings(normalizeStoredSettings(null, currentUser));
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setStoredSettings(normalizeStoredSettings(null, currentUser));
        return;
      }

      setStoredSettings(normalizeStoredSettings(JSON.parse(raw), currentUser));
    } catch {
      setStoredSettings(normalizeStoredSettings(null, currentUser));
    }
  }, [storageKey, currentUser]);

  useEffect(() => {
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(storedSettings));
    }
  }, [storageKey, storedSettings]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    let isMounted = true;

    const syncLinkedProviders = async () => {
      try {
        const items = await listLinkedProviders();
        if (!isMounted) {
          return;
        }

        updateStoredSettings((current) => {
          const nextLinked = {
            ...current.linked,
            facebook: { ...createDefaultStoredSettings().linked.facebook },
            linkedin: { ...createDefaultStoredSettings().linked.linkedin },
          };

          items.forEach((item) => {
            nextLinked[item.provider] = {
              linked: true,
              locked: false,
              email: item.email,
              displayName: current.linked[item.provider]?.displayName || profileName,
              providerId: item.providerId,
              linkedAt: current.linked[item.provider]?.linkedAt || new Date().toISOString(),
            };
          });

          if (current.linked.google?.locked) {
            nextLinked.google = current.linked.google;
          }

          return {
            ...current,
            linked: nextLinked,
          };
        });
      } catch {
        // Keep local provider state if sync is temporarily unavailable.
      }
    };

    syncLinkedProviders();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const timers = [];
    const cooldowns = [
      [usernameOtpCooldown, setUsernameOtpCooldown],
      [emailMobileCooldown, setEmailMobileCooldown],
      [emailLinkCooldown, setEmailLinkCooldown],
      [mobileCurrentCooldown, setMobileCurrentCooldown],
      [mobileNewCooldown, setMobileNewCooldown],
      [passwordOtpCooldown, setPasswordOtpCooldown],
    ];

    cooldowns.forEach(([value, setter]) => {
      if (value > 0) {
        timers.push(window.setInterval(() => setter((current) => (current > 0 ? current - 1 : 0)), 1000));
      }
    });

    return () => timers.forEach((timer) => window.clearInterval(timer));
  }, [
    usernameOtpCooldown,
    emailMobileCooldown,
    emailLinkCooldown,
    mobileCurrentCooldown,
    mobileNewCooldown,
    passwordOtpCooldown,
  ]);

  useEffect(() => {
    return () => {
      [
        usernameRecaptchaId.current,
        emailRecaptchaId.current,
        mobileCurrentRecaptchaId.current,
        mobileNewRecaptchaId.current,
        passwordRecaptchaId.current,
      ].forEach((containerId) => {
        resetFirebaseRecaptcha(containerId).catch(() => {});
      });
      resetFirebaseEmailVerification().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "billing" || !currentUser?.id) {
      return;
    }

    let ignore = false;

    const loadInvoices = async () => {
      try {
        setBillingLoading(true);
        const invoices = await listInvoices();
        if (!ignore) {
          setBillingInvoices(invoices || []);
        }
      } catch (error) {
        if (!ignore) {
          setFeedback({ type: "error", text: error.message || "Failed to load invoices." });
        }
      } finally {
        if (!ignore) {
          setBillingLoading(false);
        }
      }
    };

    loadInvoices();
    return () => {
      ignore = true;
    };
  }, [activeTab, currentUser?.id]);

  const updateStoredSettings = (updater) => {
    setStoredSettings((current) => updater(current));
  };

  const pushActivity = (text) => {
    updateStoredSettings((current) => ({
      ...current,
      activity: [createActivityEntry(text), ...(current.activity || [])].slice(0, 10),
    }));
  };

  const persistUser = (nextUser, successText) => {
    onUserUpdate(nextUser);
    setFeedback({ type: "success", text: successText });
    pushActivity(successText);
  };

  const sendStoredMobileOtp = async ({
    containerId,
    cooldown,
    setCooldown,
    setSending,
    setConfirmation,
    setVerified,
    successText,
  }) => {
    if (!MOBILE_PATTERN.test(currentUser?.mobile || "")) {
      setFeedback({ type: "error", text: "A valid saved mobile number is required before sending OTP." });
      return;
    }

    if (cooldown > 0) {
      setFeedback({ type: "error", text: `Please wait ${cooldown}s before requesting another OTP.` });
      return;
    }

    try {
      setSending?.(true);
      const confirmation = await sendFirebaseOtp(`+91${currentUser.mobile}`, containerId);
      setConfirmation(confirmation);
      setVerified(false);
      setCooldown(30);
      setFeedback({ type: "success", text: successText });
    } catch (error) {
      setFeedback({ type: "error", text: formatFirebaseMessage(error.message, "mobile") });
      await resetFirebaseRecaptcha(containerId).catch(() => {});
    } finally {
      setSending?.(false);
    }
  };

  const verifyStoredOtp = async ({
    confirmation,
    otpCode,
    setVerifying,
    setVerified,
    successText,
  }) => {
    if (!confirmation) {
      setFeedback({ type: "error", text: "Send the OTP first." });
      return;
    }

    if (!otpCode.trim()) {
      setFeedback({ type: "error", text: "Enter the OTP first." });
      return;
    }

    try {
      setVerifying?.(true);
      await verifyFirebaseOtp(confirmation, otpCode.trim());
      setVerified(true);
      setFeedback({ type: "success", text: successText });
    } catch (error) {
      setVerified(false);
      setFeedback({ type: "error", text: formatFirebaseMessage(error.message, "mobile") });
    } finally {
      setVerifying?.(false);
    }
  };

  const sendNewMobileOtp = async () => {
    if (mobileNewCooldown > 0) {
      setFeedback({ type: "error", text: `Please wait ${mobileNewCooldown}s before requesting another OTP.` });
      return;
    }

    if (!MOBILE_PATTERN.test(mobileForm.newMobile.trim())) {
      setFeedback({ type: "error", text: "Enter a valid new 10-digit mobile number first." });
      return;
    }

    try {
      const confirmation = await sendFirebaseOtp(`+91${mobileForm.newMobile.trim()}`, mobileNewRecaptchaId.current);
      setMobileNewConfirmation(confirmation);
      setMobileNewVerified(false);
      setMobileNewCooldown(30);
      setFeedback({ type: "success", text: "OTP sent to the new mobile number." });
    } catch (error) {
      setFeedback({ type: "error", text: formatFirebaseMessage(error.message, "mobile") });
      await resetFirebaseRecaptcha(mobileNewRecaptchaId.current).catch(() => {});
    }
  };

  const savePreferences = () => {
    setFeedback({ type: "success", text: "Preference settings saved successfully." });
    pushActivity("Preference settings were updated.");
  };

  const savePrivacy = () => {
    setFeedback({ type: "success", text: "Privacy settings saved successfully." });
    pushActivity("Privacy settings were updated.");
  };

  const saveNotifications = () => {
    setFeedback({ type: "success", text: "Notification settings saved successfully." });
    pushActivity("Notification settings were updated.");
  };

  const saveRegion = () => {
    setFeedback({ type: "success", text: "Region settings saved successfully." });
    pushActivity("Region settings were updated.");
  };

  const handleCancelSubscription = async () => {
    try {
      setBillingActionLoading("cancel");
      const response = await cancelSubscription();
      if (response.user) {
        onUserUpdate(response.user);
      }
      setFeedback({ type: "success", text: response.message || "Subscription canceled successfully." });
      pushActivity("Subscription canceled successfully.");
      const invoices = await listInvoices();
      setBillingInvoices(invoices || []);
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Failed to cancel subscription." });
    } finally {
      setBillingActionLoading("");
    }
  };

  const handleDownloadInvoice = async (invoiceNumber) => {
    try {
      setBillingActionLoading(`download-${invoiceNumber}`);
      await downloadInvoicePdf(invoiceNumber);
      setFeedback({ type: "success", text: `Invoice ${invoiceNumber} downloaded successfully.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Failed to download invoice." });
    } finally {
      setBillingActionLoading("");
    }
  };

  const downloadMyData = async () => {
    if (!privacyExportPassword.trim()) {
      setFeedback({ type: "error", text: "Enter your password before downloading your data." });
      return;
    }

    if (privacyExportPassword.trim().length < 8) {
      setFeedback({ type: "error", text: "Enter your full current password to continue with the data export." });
      return;
    }

    try {
      setPrivacyActionLoading("download");
      await downloadAccountDataPdf(privacyExportPassword.trim());
      setFeedback({ type: "success", text: "Your account data PDF has been downloaded." });
      pushActivity("Downloaded account data PDF.");
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Failed to download account data PDF." });
    } finally {
      setPrivacyActionLoading("");
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword.trim()) {
      setFeedback({ type: "error", text: "Enter your password before deleting your account." });
      return;
    }

    if (deleteAccountPassword.trim().length < 8) {
      setFeedback({ type: "error", text: "Enter your full current password before account deletion." });
      return;
    }

    if ((deleteConfirmationText || "").trim().toUpperCase() !== "DELETE") {
      setFeedback({ type: "error", text: "Type DELETE to confirm account deletion." });
      return;
    }

    if (!deleteReadConfirmed) {
      setFeedback({ type: "error", text: "Confirm that you have read the deletion warnings before continuing." });
      return;
    }

    try {
      setPrivacyActionLoading("delete");
      await deleteAccount({
        password: deleteAccountPassword.trim(),
        confirmationText: deleteConfirmationText.trim(),
      });
      pushActivity("Account deleted permanently.");
      onAccountDeleted?.();
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Failed to delete account." });
    } finally {
      setPrivacyActionLoading("");
    }
  };

  const resetAllSettings = () => {
    if (!resetPassword.trim()) {
      setFeedback({ type: "error", text: "Enter your password before resetting local settings." });
      return;
    }

    setStoredSettings(createDefaultStoredSettings());
    setResetPassword("");
    setFeedback({ type: "success", text: "Local settings were reset to defaults." });
    pushActivity("Local settings were reset.");
  };

  const renderAccount = () => {
    const accountSubTabs = ["personalInfo", "username", "email", "mobile"];

    return (
      <>
        <div className="workspace-subtabs">
          {accountSubTabs.map((sub) => (
            <button
              key={sub}
              className={`workspace-subtab ${accountTab === sub ? "active" : ""}`}
              type="button"
              onClick={() => setAccountTab(sub)}
            >
              {sub === "personalInfo" ? "Personal Info" : `Change ${sub.charAt(0).toUpperCase() + sub.slice(1)}`}
            </button>
          ))}
        </div>

        {accountTab === "personalInfo" ? (
          <div className="workspace-info-grid">
            {[
              ["Full Name", profileName],
              ["Username", profileUsername],
              ["Email", profileEmail],
              ["Alternate Email", profileAlternateEmail],
              ["Mobile", profileMobile],
              ["Date of Birth", profileDateOfBirth],
              ["Gender", profileGender],
              ["Security Question", profileSecurityQuestion],
              ["Security Answer", profileSecurityAnswer],
              ["Referral Code", profileReferralCode],
            ].map(([title, text]) => (
              <div key={title} className="workspace-mini-card">
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            ))}
          </div>
        ) : null}

        {accountTab === "username" ? (
          <div className="workspace-form-stack">
            <input className="auth-input workspace-static-input" value={profileUsername} disabled />
            <input
              className="auth-input workspace-static-input"
              placeholder="New username"
              value={usernameForm.newUsername}
              onChange={(event) => {
                setUsernameOtpVerified(false);
                setUsernameForm((current) => ({ ...current, newUsername: event.target.value }));
              }}
            />
            <div className="workspace-inline-action">
              <span>OTP goes to saved mobile: {currentUser.mobile}</span>
              <button
                className="header-dropdown-item"
                type="button"
                onClick={() =>
                  sendStoredMobileOtp({
                    containerId: usernameRecaptchaId.current,
                    cooldown: usernameOtpCooldown,
                    setCooldown: setUsernameOtpCooldown,
                    setSending: setUsernameOtpSending,
                    setConfirmation: setUsernameOtpConfirmation,
                    setVerified: setUsernameOtpVerified,
                    successText: "OTP sent to your saved mobile number.",
                  })
                }
                disabled={usernameOtpSending}
              >
                {usernameOtpCooldown > 0 ? `Send in ${usernameOtpCooldown}s` : "Send OTP"}
              </button>
            </div>
            <div id={usernameRecaptchaId.current} />
            <div className="inline-action-field verification-row">
              <input
                className="auth-input workspace-static-input"
                placeholder="Enter OTP sent to saved mobile"
                value={usernameForm.otp}
                onChange={(event) => {
                  setUsernameOtpVerified(false);
                  setUsernameForm((current) => ({ ...current, otp: event.target.value.trim() }));
                }}
              />
              <button
                className="inline-field-button otp-verify-button"
                type="button"
                onClick={() =>
                  verifyStoredOtp({
                    confirmation: usernameOtpConfirmation,
                    otpCode: usernameForm.otp,
                    setVerifying: setUsernameOtpVerifying,
                    setVerified: setUsernameOtpVerified,
                    successText: "Saved mobile OTP verified successfully.",
                  })
                }
                disabled={usernameOtpVerified || usernameOtpVerifying}
              >
                {usernameOtpVerified ? "Verified" : usernameOtpVerifying ? "Verifying..." : "Verify"}
              </button>
            </div>
            <div className="workspace-captcha-row">
              <div className="captcha-box">{usernameCaptcha}</div>
              <button className="header-dropdown-item" type="button" onClick={() => setUsernameCaptcha(buildCaptcha())}>Refresh</button>
            </div>
            <input
              className="auth-input workspace-static-input"
              placeholder="Enter CAPTCHA"
              value={usernameForm.captchaInput}
              onChange={(event) => setUsernameForm((current) => ({ ...current, captchaInput: event.target.value }))}
            />
            <button
              className="primary-button"
              type="button"
              disabled={usernameSaving}
              onClick={async () => {
                const nextUsername = usernameForm.newUsername.trim();
                if (nextUsername.length < 4) {
                  setFeedback({ type: "error", text: "Username must be at least 4 characters." });
                  return;
                }
                if (nextUsername.toLowerCase() === profileUsername.toLowerCase()) {
                  setFeedback({ type: "error", text: "Enter a different username." });
                  return;
                }
                if (!usernameOtpVerified) {
                  setFeedback({ type: "error", text: "Verify the OTP sent to the saved mobile number first." });
                  return;
                }
                if (usernameForm.captchaInput.trim().toUpperCase() !== usernameCaptcha) {
                  setFeedback({ type: "error", text: "Captcha does not match." });
                  return;
                }

                try {
                  setUsernameSaving(true);
                  const updatedUser = await updateUsername({ userId: currentUser.id, newUsername: nextUsername });
                  persistUser(updatedUser, "Username updated successfully.");
                  setUsernameForm({ newUsername: "", otp: "", captchaInput: "" });
                  setUsernameOtpConfirmation(null);
                  setUsernameOtpVerified(false);
                  setUsernameCaptcha(buildCaptcha());
                } catch (error) {
                  setFeedback({ type: "error", text: error.message });
                } finally {
                  setUsernameSaving(false);
                }
              }}
            >
              {usernameSaving ? "Updating..." : "Verify & Update"}
            </button>
          </div>
        ) : null}

        {accountTab === "email" ? (
          <div className="workspace-form-stack">
            <input className="auth-input workspace-static-input" value={profileEmail} disabled />
            <input
              className="auth-input workspace-static-input"
              placeholder="New email"
              value={emailForm.newEmail}
              onChange={(event) => {
                setEmailVerified(false);
                setEmailVerificationSent(false);
                setEmailForm((current) => ({ ...current, newEmail: event.target.value }));
              }}
            />
            <input
              className="auth-input workspace-static-input"
              type="password"
              placeholder="Current password"
              value={emailForm.currentPassword}
              onChange={(event) => setEmailForm((current) => ({ ...current, currentPassword: event.target.value }))}
            />
            <div className="workspace-inline-action">
              <span>OTP goes to saved mobile: {currentUser.mobile}</span>
              <button
                className="header-dropdown-item"
                type="button"
                onClick={() =>
                  sendStoredMobileOtp({
                    containerId: emailRecaptchaId.current,
                    cooldown: emailMobileCooldown,
                    setCooldown: setEmailMobileCooldown,
                    setSending: setEmailOtpSending,
                    setConfirmation: setEmailMobileConfirmation,
                    setVerified: setEmailMobileVerified,
                    successText: "OTP sent to your saved mobile number.",
                  })
                }
                disabled={emailOtpSending}
              >
                {emailMobileCooldown > 0 ? `Send in ${emailMobileCooldown}s` : "Send Mobile OTP"}
              </button>
            </div>
            <div id={emailRecaptchaId.current} />
            <div className="inline-action-field verification-row">
              <input
                className="auth-input workspace-static-input"
                placeholder="Enter OTP sent to saved mobile"
                value={emailForm.mobileOtp}
                onChange={(event) => {
                  setEmailMobileVerified(false);
                  setEmailForm((current) => ({ ...current, mobileOtp: event.target.value.trim() }));
                }}
              />
              <button
                className="inline-field-button otp-verify-button"
                type="button"
                onClick={() =>
                  verifyStoredOtp({
                    confirmation: emailMobileConfirmation,
                    otpCode: emailForm.mobileOtp,
                    setVerifying: setEmailOtpVerifying,
                    setVerified: setEmailMobileVerified,
                    successText: "Saved mobile OTP verified successfully.",
                  })
                }
                disabled={emailMobileVerified || emailOtpVerifying}
              >
                {emailMobileVerified ? "Verified" : emailOtpVerifying ? "Verifying..." : "Verify"}
              </button>
            </div>
            <div className="workspace-inline-action">
              <span>Verify the newly entered email before updating it.</span>
              <button
                className="header-dropdown-item"
                type="button"
                onClick={async () => {
                  if (emailLinkCooldown > 0) {
                    setFeedback({ type: "error", text: `Please wait ${emailLinkCooldown}s before sending another email link.` });
                    return;
                  }
                  if (!EMAIL_PATTERN.test(emailForm.newEmail.trim())) {
                    setFeedback({ type: "error", text: "Enter a valid new email address first." });
                    return;
                  }
                  if (!emailForm.currentPassword.trim()) {
                    setFeedback({ type: "error", text: "Enter the current password before sending the email verification link." });
                    return;
                  }

                  try {
                    setEmailLinkSending(true);
                    await sendFirebaseEmailVerification(emailForm.newEmail.trim(), emailForm.currentPassword);
                    setEmailVerificationSent(true);
                    setEmailVerified(false);
                    setEmailLinkCooldown(30);
                    setFeedback({ type: "success", text: "Verification email sent. Open it, then click Verify below." });
                  } catch (error) {
                    setFeedback({ type: "error", text: formatFirebaseMessage(error.message, "email") });
                  } finally {
                    setEmailLinkSending(false);
                  }
                }}
                disabled={emailLinkSending}
              >
                {emailLinkCooldown > 0 ? `Send in ${emailLinkCooldown}s` : "Send Email Link"}
              </button>
            </div>
            <button
              className="header-dropdown-item"
              type="button"
              onClick={async () => {
                if (!emailVerificationSent) {
                  setFeedback({ type: "error", text: "Send the verification email first." });
                  return;
                }

                try {
                  setEmailVerifying(true);
                  await checkFirebaseEmailVerification(emailForm.newEmail.trim());
                  setEmailVerified(true);
                  setFeedback({ type: "success", text: "New email verified successfully." });
                } catch (error) {
                  setEmailVerified(false);
                  setFeedback({ type: "error", text: formatFirebaseMessage(error.message, "email") });
                } finally {
                  setEmailVerifying(false);
                }
              }}
              disabled={emailVerified || emailVerifying}
            >
              {emailVerified ? "Email Verified" : emailVerifying ? "Verifying..." : "Verify New Email"}
            </button>
            <div className="workspace-captcha-row">
              <div className="captcha-box">{emailCaptcha}</div>
              <button className="header-dropdown-item" type="button" onClick={() => setEmailCaptcha(buildCaptcha())}>Refresh</button>
            </div>
            <input
              className="auth-input workspace-static-input"
              placeholder="Enter CAPTCHA"
              value={emailForm.captchaInput}
              onChange={(event) => setEmailForm((current) => ({ ...current, captchaInput: event.target.value }))}
            />
            <button
              className="primary-button"
              type="button"
              disabled={emailSaving}
              onClick={async () => {
                if (!EMAIL_PATTERN.test(emailForm.newEmail.trim())) {
                  setFeedback({ type: "error", text: "Enter a valid new email address." });
                  return;
                }
                if (emailForm.newEmail.trim().toLowerCase() === profileEmail.toLowerCase()) {
                  setFeedback({ type: "error", text: "Enter a different email address." });
                  return;
                }
                if (!emailMobileVerified) {
                  setFeedback({ type: "error", text: "Verify the OTP sent to the saved mobile number first." });
                  return;
                }
                if (!emailVerified) {
                  setFeedback({ type: "error", text: "Verify the newly entered email address first." });
                  return;
                }
                if (emailForm.captchaInput.trim().toUpperCase() !== emailCaptcha) {
                  setFeedback({ type: "error", text: "Captcha does not match." });
                  return;
                }

                try {
                  setEmailSaving(true);
                  const updatedUser = await updateEmail({
                    userId: currentUser.id,
                    newEmail: emailForm.newEmail.trim().toLowerCase(),
                  });
                  persistUser(updatedUser, "Email updated successfully.");
                  setEmailForm({ newEmail: "", currentPassword: "", mobileOtp: "", captchaInput: "" });
                  setEmailMobileConfirmation(null);
                  setEmailMobileVerified(false);
                  setEmailVerificationSent(false);
                  setEmailVerified(false);
                  setEmailCaptcha(buildCaptcha());
                  await resetFirebaseEmailVerification().catch(() => {});
                } catch (error) {
                  setFeedback({ type: "error", text: error.message });
                } finally {
                  setEmailSaving(false);
                }
              }}
            >
              {emailSaving ? "Updating..." : "Verify & Update"}
            </button>
          </div>
        ) : null}

        {accountTab === "mobile" ? (
          <div className="workspace-form-stack">
            <input className="auth-input workspace-static-input" value={currentUser.mobile} disabled />
            <input
              className="auth-input workspace-static-input"
              placeholder="New 10-digit mobile number"
              value={mobileForm.newMobile}
              onChange={(event) => {
                setMobileNewVerified(false);
                setMobileForm((current) => ({
                  ...current,
                  newMobile: event.target.value.replace(/[^\d]/g, "").slice(0, 10),
                }));
              }}
            />
            <div className="workspace-inline-action">
              <span>First OTP goes to saved mobile: {currentUser.mobile}</span>
              <button
                className="header-dropdown-item"
                type="button"
                onClick={() =>
                  sendStoredMobileOtp({
                    containerId: mobileCurrentRecaptchaId.current,
                    cooldown: mobileCurrentCooldown,
                    setCooldown: setMobileCurrentCooldown,
                    setConfirmation: setMobileCurrentConfirmation,
                    setVerified: setMobileCurrentVerified,
                    successText: "OTP sent to your saved mobile number.",
                  })
                }
              >
                {mobileCurrentCooldown > 0 ? `Send in ${mobileCurrentCooldown}s` : "Send Saved Mobile OTP"}
              </button>
            </div>
            <div id={mobileCurrentRecaptchaId.current} />
            <div className="inline-action-field verification-row">
              <input
                className="auth-input workspace-static-input"
                placeholder="Enter OTP sent to saved mobile"
                value={mobileForm.currentOtp}
                onChange={(event) => {
                  setMobileCurrentVerified(false);
                  setMobileForm((current) => ({ ...current, currentOtp: event.target.value.trim() }));
                }}
              />
              <button
                className="inline-field-button otp-verify-button"
                type="button"
                onClick={() =>
                  verifyStoredOtp({
                    confirmation: mobileCurrentConfirmation,
                    otpCode: mobileForm.currentOtp,
                    setVerified: setMobileCurrentVerified,
                    successText: "Saved mobile OTP verified successfully.",
                  })
                }
                disabled={mobileCurrentVerified}
              >
                {mobileCurrentVerified ? "Verified" : "Verify"}
              </button>
            </div>
            <div className="workspace-inline-action">
              <span>Second OTP goes to new mobile: {mobileForm.newMobile || "Not entered yet"}</span>
              <button className="header-dropdown-item" type="button" onClick={sendNewMobileOtp}>
                {mobileNewCooldown > 0 ? `Send in ${mobileNewCooldown}s` : "Send New Mobile OTP"}
              </button>
            </div>
            <div id={mobileNewRecaptchaId.current} />
            <div className="inline-action-field verification-row">
              <input
                className="auth-input workspace-static-input"
                placeholder="Enter OTP sent to new mobile"
                value={mobileForm.newOtp}
                onChange={(event) => {
                  setMobileNewVerified(false);
                  setMobileForm((current) => ({ ...current, newOtp: event.target.value.trim() }));
                }}
              />
              <button
                className="inline-field-button otp-verify-button"
                type="button"
                onClick={() =>
                  verifyStoredOtp({
                    confirmation: mobileNewConfirmation,
                    otpCode: mobileForm.newOtp,
                    setVerified: setMobileNewVerified,
                    successText: "New mobile OTP verified successfully.",
                  })
                }
                disabled={mobileNewVerified}
              >
                {mobileNewVerified ? "Verified" : "Verify"}
              </button>
            </div>
            <div className="workspace-captcha-row">
              <div className="captcha-box">{mobileCaptcha}</div>
              <button className="header-dropdown-item" type="button" onClick={() => setMobileCaptcha(buildCaptcha())}>Refresh</button>
            </div>
            <input
              className="auth-input workspace-static-input"
              placeholder="Enter CAPTCHA"
              value={mobileForm.captchaInput}
              onChange={(event) => setMobileForm((current) => ({ ...current, captchaInput: event.target.value }))}
            />
            <button
              className="primary-button"
              type="button"
              disabled={mobileSaving}
              onClick={async () => {
                if (!MOBILE_PATTERN.test(mobileForm.newMobile.trim())) {
                  setFeedback({ type: "error", text: "Enter a valid new 10-digit mobile number." });
                  return;
                }
                if (mobileForm.newMobile.trim() === currentUser.mobile) {
                  setFeedback({ type: "error", text: "Enter a different mobile number." });
                  return;
                }
                if (!mobileCurrentVerified) {
                  setFeedback({ type: "error", text: "Verify the OTP sent to the saved mobile number first." });
                  return;
                }
                if (!mobileNewVerified) {
                  setFeedback({ type: "error", text: "Verify the OTP sent to the new mobile number first." });
                  return;
                }
                if (mobileForm.captchaInput.trim().toUpperCase() !== mobileCaptcha) {
                  setFeedback({ type: "error", text: "Captcha does not match." });
                  return;
                }

                try {
                  setMobileSaving(true);
                  const updatedUser = await updateMobile({
                    userId: currentUser.id,
                    newMobile: mobileForm.newMobile.trim(),
                  });
                  persistUser(updatedUser, "Mobile number updated successfully.");
                  setMobileForm({ newMobile: "", currentOtp: "", newOtp: "", captchaInput: "" });
                  setMobileCurrentConfirmation(null);
                  setMobileCurrentVerified(false);
                  setMobileNewConfirmation(null);
                  setMobileNewVerified(false);
                  setMobileCaptcha(buildCaptcha());
                } catch (error) {
                  setFeedback({ type: "error", text: error.message });
                } finally {
                  setMobileSaving(false);
                }
              }}
            >
              {mobileSaving ? "Updating..." : "Verify & Update"}
            </button>
          </div>
        ) : null}
      </>
    );
  };

  const renderSecurity = () => {
    const securitySubTabs = ["password", "twoStep"];

    return (
      <>
        <div className="workspace-subtabs">
          {securitySubTabs.map((sub) => (
            <button
              key={sub}
              className={`workspace-subtab ${securityTab === sub ? "active" : ""}`}
              type="button"
              onClick={() => setSecurityTab(sub)}
            >
              {sub === "password" ? "Change Password" : "Two-Step Verification"}
            </button>
          ))}
        </div>

        {securityTab === "password" ? (
          <div className="workspace-form-stack">
            <input
              className="auth-input workspace-static-input"
              placeholder="Current Password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
            />
            <input
              className="auth-input workspace-static-input"
              placeholder="New Password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
            />
            <input
              className="auth-input workspace-static-input"
              placeholder="Confirm New Password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            />
            <div className="workspace-inline-action">
              <span>OTP goes to saved mobile: {currentUser.mobile}</span>
              <button
                className="header-dropdown-item"
                type="button"
                onClick={() =>
                  sendStoredMobileOtp({
                    containerId: passwordRecaptchaId.current,
                    cooldown: passwordOtpCooldown,
                    setCooldown: setPasswordOtpCooldown,
                    setConfirmation: setPasswordOtpConfirmation,
                    setVerified: setPasswordOtpVerified,
                    successText: "OTP sent to your saved mobile number.",
                  })
                }
              >
                {passwordOtpCooldown > 0 ? `Send in ${passwordOtpCooldown}s` : "Send OTP"}
              </button>
            </div>
            <div id={passwordRecaptchaId.current} />
            <div className="inline-action-field verification-row">
              <input
                className="auth-input workspace-static-input"
                placeholder="Enter OTP sent to saved mobile"
                value={passwordForm.otp}
                onChange={(event) => {
                  setPasswordOtpVerified(false);
                  setPasswordForm((current) => ({ ...current, otp: event.target.value.trim() }));
                }}
              />
              <button
                className="inline-field-button otp-verify-button"
                type="button"
                onClick={() =>
                  verifyStoredOtp({
                    confirmation: passwordOtpConfirmation,
                    otpCode: passwordForm.otp,
                    setVerified: setPasswordOtpVerified,
                    successText: "Saved mobile OTP verified successfully.",
                  })
                }
                disabled={passwordOtpVerified}
              >
                {passwordOtpVerified ? "Verified" : "Verify"}
              </button>
            </div>
            <div className="workspace-captcha-row">
              <div className="captcha-box">{passwordCaptcha}</div>
              <button className="header-dropdown-item" type="button" onClick={() => setPasswordCaptcha(buildCaptcha())}>Refresh</button>
            </div>
            <input
              className="auth-input workspace-static-input"
              placeholder="Enter CAPTCHA"
              value={passwordForm.captchaInput}
              onChange={(event) => setPasswordForm((current) => ({ ...current, captchaInput: event.target.value }))}
            />
            <button
              className="primary-button"
              type="button"
              disabled={passwordSaving}
              onClick={async () => {
                if (!passwordForm.currentPassword) {
                  setFeedback({ type: "error", text: "Enter the current password." });
                  return;
                }
                if (!PASSWORD_PATTERN.test(passwordForm.newPassword)) {
                  setFeedback({ type: "error", text: "Use 8+ characters with upper, lower, and a number." });
                  return;
                }
                if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                  setFeedback({ type: "error", text: "New passwords do not match." });
                  return;
                }
                if (!passwordOtpVerified) {
                  setFeedback({ type: "error", text: "Verify the OTP sent to the saved mobile number first." });
                  return;
                }
                if (passwordForm.captchaInput.trim().toUpperCase() !== passwordCaptcha) {
                  setFeedback({ type: "error", text: "Captcha does not match." });
                  return;
                }

                try {
                  setPasswordSaving(true);
                  await changePassword({
                    userId: currentUser.id,
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                  });
                  setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "", otp: "", captchaInput: "" });
                  setPasswordOtpConfirmation(null);
                  setPasswordOtpVerified(false);
                  setPasswordCaptcha(buildCaptcha());
                  setFeedback({ type: "success", text: "Password updated successfully." });
                  pushActivity("Password was changed successfully.");
                } catch (error) {
                  setFeedback({ type: "error", text: error.message });
                } finally {
                  setPasswordSaving(false);
                }
              }}
            >
              {passwordSaving ? "Updating..." : "Confirm"}
            </button>
          </div>
        ) : (
          <div className="workspace-form-stack">
            <select
              className="auth-input workspace-static-input"
              value={storedSettings.security.twoStepEnabled ? "Yes" : "No"}
              onChange={(event) =>
                updateStoredSettings((current) => ({
                  ...current,
                  security: { ...current.security, twoStepEnabled: event.target.value === "Yes" },
                }))
              }
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setFeedback({
                  type: "success",
                  text: `Two-step verification ${storedSettings.security.twoStepEnabled ? "enabled" : "disabled"} successfully.`,
                });
                pushActivity("Two-step verification setting was updated.");
              }}
            >
              Save Two-Step Setting
            </button>
          </div>
        )}
      </>
    );
  };

  const renderPreferences = () => {
    const preferencesSubTabs = ["theme", "language", "font"];

    return (
      <>
        <div className="workspace-subtabs">
          {preferencesSubTabs.map((sub) => (
            <button
              key={sub}
              className={`workspace-subtab ${preferencesTab === sub ? "active" : ""}`}
              type="button"
              onClick={() => setPreferencesTab(sub)}
            >
              Change {sub.charAt(0).toUpperCase() + sub.slice(1)}
            </button>
          ))}
        </div>
        <div className="workspace-form-stack">
          {preferencesTab === "theme" ? (
            <select
              className="auth-input workspace-static-input"
              value={storedSettings.preferences.theme}
              onChange={(event) =>
                updateStoredSettings((current) => ({
                  ...current,
                  preferences: { ...current.preferences, theme: event.target.value },
                }))
              }
            >
              <option>Light</option>
              <option>Dark</option>
            </select>
          ) : null}
          {preferencesTab === "language" ? (
            <select
              className="auth-input workspace-static-input"
              value={storedSettings.preferences.language}
              onChange={(event) =>
                updateStoredSettings((current) => ({
                  ...current,
                  preferences: { ...current.preferences, language: event.target.value },
                }))
              }
            >
              <option>English</option>
              <option>Hindi</option>
            </select>
          ) : null}
          {preferencesTab === "font" ? (
            <select
              className="auth-input workspace-static-input"
              value={storedSettings.preferences.font}
              onChange={(event) =>
                updateStoredSettings((current) => ({
                  ...current,
                  preferences: { ...current.preferences, font: event.target.value },
                }))
              }
            >
              <option>Segoe UI</option>
              <option>Roboto</option>
              <option>Arial</option>
            </select>
          ) : null}
          <button className="primary-button" type="button" onClick={savePreferences}>Save Preference</button>
        </div>
      </>
    );
  };

  if (activeTab === "account") {
    return (
      <div className="workspace-form-stack">
        <div className={`workspace-mini-card ${feedback.type === "error" ? "error-text" : feedback.type === "success" ? "success-text" : ""}`}>
          <p>{feedback.text}</p>
        </div>
        {renderAccount()}
      </div>
    );
  }

  if (activeTab === "security") {
    return (
      <div className="workspace-form-stack">
        <div className={`workspace-mini-card ${feedback.type === "error" ? "error-text" : feedback.type === "success" ? "success-text" : ""}`}>
          <p>{feedback.text}</p>
        </div>
        {renderSecurity()}
      </div>
    );
  }

  if (activeTab === "preferences") {
    return (
      <div className="workspace-form-stack">
        <div className={`workspace-mini-card ${feedback.type === "error" ? "error-text" : feedback.type === "success" ? "success-text" : ""}`}>
          <p>{feedback.text}</p>
        </div>
        {renderPreferences()}
      </div>
    );
  }

  if (activeTab === "privacy") {
    return (
      <div className="workspace-form-stack">
        <div className={`workspace-mini-card ${feedback.type === "error" ? "error-text" : feedback.type === "success" ? "success-text" : ""}`}>
          <p>{feedback.text}</p>
        </div>
        <p className="tool-copy workspace-copy-paragraph">Manage your data preferences below:</p>
        <div className="billing-action-row privacy-action-row">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setShowExportPanel((current) => !current);
              setShowDeletePanel(false);
            }}
          >
            {showExportPanel ? "Hide Download Panel" : "Download My Data"}
          </button>
          <button
            className="primary-button danger-tone"
            type="button"
            onClick={() => {
              setShowDeletePanel((current) => !current);
              setShowExportPanel(false);
            }}
          >
            {showDeletePanel ? "Hide Delete Panel" : "Delete My Account"}
          </button>
          <button className="primary-button" type="button" onClick={savePrivacy}>
            Save Privacy Settings
          </button>
        </div>
        {showExportPanel ? (
          <div className="workspace-mini-card privacy-export-card">
            <div className="billing-payment-card-head">
              <div>
                <h4>Portable Data Export</h4>
                <p>Enter your current password to download a polished PDF with account details, subscription data, payment history, linked providers, and support records.</p>
              </div>
              <span className="billing-status-pill">Download only</span>
            </div>
            <div className="workspace-form-stack privacy-inline-stack">
              <input
                className="auth-input workspace-static-input"
                type="password"
                placeholder="Enter current password for PDF download"
                value={privacyExportPassword}
                onChange={(event) => setPrivacyExportPassword(event.target.value)}
              />
              <button className="primary-button" type="button" onClick={downloadMyData} disabled={privacyActionLoading === "download"}>
                {privacyActionLoading === "download" ? "Downloading..." : "Confirm PDF Download"}
              </button>
            </div>
          </div>
        ) : null}
        {showDeletePanel ? (
          <div className="workspace-mini-card privacy-delete-card">
            <div className="billing-payment-card-head">
              <div>
                <h4>Delete Account Confirmation</h4>
                <p>Review these details carefully before permanent deletion. This removes your profile, linked providers, support requests, invoices, and subscription history.</p>
              </div>
              <span className="billing-status-pill danger-pill">Permanent</span>
            </div>
            <div className="workspace-info-grid privacy-capability-grid">
              <div className="workspace-mini-card"><h4>Full Name</h4><p>{profileName}</p></div>
              <div className="workspace-mini-card"><h4>Member ID</h4><p>{currentUser?.publicUserCode || "Not available"}</p></div>
              <div className="workspace-mini-card"><h4>Username</h4><p>{profileUsername}</p></div>
              <div className="workspace-mini-card"><h4>Email</h4><p>{profileEmail}</p></div>
              <div className="workspace-mini-card"><h4>Mobile</h4><p>{profileMobile}</p></div>
              <div className="workspace-mini-card"><h4>Current Plan</h4><p>{subscriptionPlanName}</p></div>
            </div>
            <div className="workspace-mini-card privacy-delete-points">
              <h4>Read Before Deleting</h4>
              <ul className="privacy-warning-list">
                <li>Your profile, linked providers, billing history, and support records will be permanently removed.</li>
                <li>Downloaded invoices and exported PDFs already saved on your device will not be affected.</li>
                <li>Premium access, subscription status, and payment references will no longer be available in this account.</li>
                <li>This action cannot be undone after you confirm with your password and the word DELETE.</li>
              </ul>
              <label className="terms-check privacy-read-confirm">
                <input
                  type="checkbox"
                  checked={deleteReadConfirmed}
                  onChange={(event) => setDeleteReadConfirmed(event.target.checked)}
                />
                <span>I have read and understood the permanent account deletion warnings.</span>
              </label>
            </div>
            <div className="workspace-form-stack privacy-inline-stack">
              <input
                className="auth-input workspace-static-input"
                type="password"
                placeholder="Enter current password to delete account"
                value={deleteAccountPassword}
                onChange={(event) => setDeleteAccountPassword(event.target.value)}
              />
              <input
                className="auth-input workspace-static-input"
                type="text"
                placeholder='Type DELETE to confirm permanent removal'
                value={deleteConfirmationText}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
              />
              <button
                className="primary-button danger-tone"
                type="button"
                onClick={handleDeleteAccount}
                disabled={privacyActionLoading === "delete" || !deleteReadConfirmed}
              >
                {privacyActionLoading === "delete" ? "Deleting..." : "Confirm Delete Account"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeTab === "platform") {
    return (
      <div className="workspace-form-stack">
        <div className="workspace-mini-card privacy-export-card">
          <div className="billing-payment-card-head">
            <div>
              <h4>Platform Readiness</h4>
              <p>Everything added for deploy-ready billing operations, documentation flow, support visibility, analytics, and payment lifecycle handling.</p>
            </div>
            <span className="billing-status-pill">New category</span>
          </div>
        </div>
        <div className="workspace-info-grid privacy-capability-grid">
          <div className="workspace-mini-card">
            <h4>Production Hardening</h4>
            <p>Secured authenticated downloads, persisted billing records, and server-generated documents make the export flow deployment-ready.</p>
          </div>
          <div className="workspace-mini-card">
            <h4>Documentation</h4>
            <p>Your PDF organizes identity, subscription, support, and payment records in one clean handover document.</p>
          </div>
          <div className="workspace-mini-card">
            <h4>Bug Support</h4>
            <p>Saved support request history stays attached to the export so troubleshooting context travels with the member record.</p>
          </div>
          <div className="workspace-mini-card">
            <h4>Analytics</h4>
            <p>Transactions, invoice counts, lifecycle dates, and member billing status stay grouped for quick audit and reporting.</p>
          </div>
          <div className="workspace-mini-card">
            <h4>Payment Lifecycle</h4>
            <p>Activation, expiry, cancel state, invoice numbers, and Razorpay payment references remain visible in one timeline.</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "activity") {
    return (
      <div className="workspace-form-stack">
        <p className="tool-copy workspace-copy-paragraph">Recent account activities:</p>
        {activityEntries.length > 0 ? activityEntries.map((entry) => (
          <div key={entry.id} className="workspace-mini-card"><p>{entry.text}</p></div>
        )) : <div className="workspace-mini-card"><p>No activity recorded yet.</p></div>}
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            updateStoredSettings((current) => ({ ...current, activity: [] }));
            setFeedback({ type: "success", text: "Activity log cleared." });
          }}
        >
          Clear Activity Log
        </button>
      </div>
    );
  }

  if (activeTab === "linked") {
    const providers = [
      {
        key: "google",
        label: "Google",
        description: /@gmail\.com$/i.test(profileEmail)
          ? "Primary Google sign-in for this Gmail account. It stays linked."
          : "Connect your Google account for verified sign-in access.",
      },
      {
        key: "facebook",
        label: "Facebook",
        description: "Link your Facebook account to this signed-in account using the secure OAuth popup.",
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        description: "Link your LinkedIn account to this signed-in account using the secure OAuth popup.",
      },
    ];
    return (
      <div className="workspace-form-stack">
        {feedback.text ? (
          <div className={`workspace-mini-card ${feedback.type === "error" ? "error-text" : feedback.type === "success" ? "success-text" : ""}`}>
            <p>{feedback.text}</p>
          </div>
        ) : null}
        <div className="workspace-info-grid linked-provider-grid">
          {providers.map(({ key, label, description }) => {
            const linkedState = storedSettings.linked[key];
            const isLinked = !!linkedState?.linked;
            const isLocked = !!linkedState?.locked;
            const form = linkedForms[key];

            return (
              <div key={key} className={`workspace-mini-card linked-provider-card ${isLinked ? "is-linked" : ""}`}>
                <div className="linked-provider-head">
                  <div className="linked-provider-brand">
                    <span className={`linked-provider-icon ${key}`}>
                      <ProviderIcon providerKey={key} />
                    </span>
                    <div>
                      <h4>{label}</h4>
                      <p>{description}</p>
                    </div>
                  </div>
                  <span className={`linked-provider-badge ${isLinked ? "linked" : "not-linked"}`}>
                    {isLocked ? "Primary" : isLinked ? "Linked" : "Not Linked"}
                  </span>
                </div>

                <div className="linked-provider-meta">
                  <div className="linked-provider-meta-item">
                    <span>Status</span>
                    <strong>{isLocked ? "Primary linked provider" : isLinked ? "Validated and linked" : "Waiting to be linked"}</strong>
                  </div>
                  <div className="linked-provider-meta-item">
                    <span>Linked Email</span>
                    <strong>{linkedState?.email || "Not linked yet"}</strong>
                  </div>
                  <div className="linked-provider-meta-item">
                    <span>Profile</span>
                    <strong>{linkedState?.displayName || profileName}</strong>
                  </div>
                  <div className="linked-provider-meta-item">
                    <span>Validated</span>
                    <strong>{isLinked ? formatLinkedDate(linkedState?.linkedAt) : "Not verified yet"}</strong>
                  </div>
                </div>

                <div className="linked-provider-actions">
                  <button
                    className={`primary-button ${isLinked && !isLocked ? "secondary-tone" : ""}`}
                    type="button"
                    disabled={linkedSaving[key] || isLocked}
                    onClick={async () => {
                      if (isLocked) {
                        setFeedback({ type: "info", text: "Google stays linked because this account is using Gmail as the primary sign-in." });
                        return;
                      }

                      if (isLinked) {
                        try {
                          setLinkedSaving((current) => ({ ...current, [key]: true }));
                          await unlinkProvider(key);
                          updateStoredSettings((current) => ({
                            ...current,
                            linked: {
                              ...current.linked,
                              [key]: createDefaultStoredSettings().linked[key],
                            },
                          }));
                          setLinkedForms((current) => ({
                            ...current,
                            [key]: { currentPassword: "" },
                          }));
                          setFeedback({ type: "success", text: `${label} account unlinked successfully.` });
                          pushActivity(`${label} account was unlinked.`);
                        } catch (error) {
                          setFeedback({ type: "error", text: error.message || `Failed to unlink ${label}.` });
                        } finally {
                          setLinkedSaving((current) => ({ ...current, [key]: false }));
                        }
                        return;
                      }

                      try {
                        setLinkedSaving((current) => ({ ...current, [key]: true }));
                        const providerProfile = await authorizeLinkedProvider(key, window.location.origin);
                        if (!EMAIL_PATTERN.test((providerProfile.email || "").trim())) {
                          throw new Error(`${label} did not return a valid email address.`);
                        }
                        if (!(providerProfile.providerId || "").trim()) {
                          throw new Error(`${label} did not return a valid account identifier.`);
                        }

                        updateStoredSettings((current) => ({
                          ...current,
                          linked: {
                            ...current.linked,
                            [key]: {
                              linked: true,
                              locked: false,
                              email: providerProfile.email || "",
                              displayName: providerProfile.displayName || profileName,
                              providerId: providerProfile.providerId || "",
                              linkedAt: new Date().toISOString(),
                            },
                          },
                        }));
                        setLinkedForms((current) => ({
                          ...current,
                          [key]: { currentPassword: "" },
                        }));
                        setFeedback({ type: "success", text: `${label} linked successfully.` });
                        pushActivity(`${label} account linked successfully.`);
                      } catch (error) {
                        setFeedback({ type: "error", text: error.message || `Failed to link ${label}.` });
                      } finally {
                        setLinkedSaving((current) => ({ ...current, [key]: false }));
                      }
                    }}
                  >
                    {isLocked ? "Primary Gmail" : linkedSaving[key] ? "Saving..." : isLinked ? `Unlink ${label}` : `Link ${label}`}
                  </button>
                </div>

                {!isLocked ? (
                  <div className="linked-provider-form">
                    {!isLinked ? <p className="tool-copy workspace-copy-paragraph">Click the link button to open the provider popup. The provider account will be linked to your current signed-in account after OAuth completes.</p> : null}
                    <input
                      className="auth-input workspace-static-input"
                      type="password"
                      placeholder={isLinked ? "Linked account can be unlinked directly" : "No password required for provider linking"}
                      value={form.currentPassword}
                      onChange={(event) =>
                        setLinkedForms((current) => ({
                          ...current,
                          [key]: { ...current[key], currentPassword: event.target.value },
                        }))
                      }
                      disabled
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeTab === "notifications") {
    return (
      <div className="workspace-form-stack">
        <label className="terms-check">
          <input
            type="checkbox"
            checked={storedSettings.notifications.emailAlerts}
            onChange={(event) =>
              updateStoredSettings((current) => ({
                ...current,
                notifications: { ...current.notifications, emailAlerts: event.target.checked },
              }))
            }
          />
          <span>Email Alerts</span>
        </label>
        <label className="terms-check">
          <input
            type="checkbox"
            checked={storedSettings.notifications.smsNotifications}
            onChange={(event) =>
              updateStoredSettings((current) => ({
                ...current,
                notifications: { ...current.notifications, smsNotifications: event.target.checked },
              }))
            }
          />
          <span>SMS Notifications</span>
        </label>
        <label className="terms-check">
          <input
            type="checkbox"
            checked={storedSettings.notifications.inAppAlerts}
            onChange={(event) =>
              updateStoredSettings((current) => ({
                ...current,
                notifications: { ...current.notifications, inAppAlerts: event.target.checked },
              }))
            }
          />
          <span>In-App Alerts</span>
        </label>
        <button className="primary-button" type="button" onClick={saveNotifications}>Save Preferences</button>
      </div>
    );
  }

  if (activeTab === "billing") {
    return (
      <div className="workspace-form-stack">
        <div className="workspace-mini-card"><h4>Subscription & Billing</h4><p>Plan: {subscriptionPlanName} | {subscriptionPriceLabel}</p></div>
        <div className="workspace-mini-card"><h4>Membership Status</h4><p>Status: {subscriptionStatus === "premium" ? "Premium Active" : subscriptionStatus === "expired" ? "Expired" : subscriptionStatus === "canceled" ? "Canceled" : "Free Access"}{subscriptionActivatedAt ? ` | Activated: ${new Date(subscriptionActivatedAt).toLocaleDateString("en-GB")}` : ""}{subscriptionExpiresAt ? ` | Valid Till: ${new Date(subscriptionExpiresAt).toLocaleDateString("en-GB")}` : ""}</p></div>

        <div className="billing-action-row">
          <button className="primary-button" type="button" onClick={() => setShowPaymentDetails((current) => !current)}>
            {showPaymentDetails ? "Hide Payment Details" : "Manage Payment Method"}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              const target = document.getElementById("billing-invoices-section");
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            View Invoices
          </button>
          <button
            className="primary-button secondary-tone"
            type="button"
            onClick={handleCancelSubscription}
            disabled={billingActionLoading === "cancel" || subscriptionStatus !== "premium"}
          >
            {billingActionLoading === "cancel" ? "Canceling..." : "Cancel Subscription"}
          </button>
        </div>

        {showPaymentDetails ? (
          <div className="workspace-mini-card billing-payment-card">
            <div className="billing-payment-card-head">
              <div>
                <h4>Saved Payment Details</h4>
                <p>Verified payment information from your latest successful invoice.</p>
              </div>
              <span className="billing-status-pill">{latestInvoice?.status || "No invoice"}</span>
            </div>
            <div className="workspace-info-grid">
              <div className="workspace-mini-card"><h4>Payment Provider</h4><p>Razorpay Secure Checkout</p></div>
              <div className="workspace-mini-card"><h4>Latest Invoice</h4><p>{latestInvoice?.invoiceNumber || "Not available"}</p></div>
              <div className="workspace-mini-card"><h4>Payment ID</h4><p>{latestInvoice?.razorpayPaymentId || "Not available"}</p></div>
              <div className="workspace-mini-card"><h4>Order ID</h4><p>{latestInvoice?.razorpayOrderId || "Not available"}</p></div>
            </div>
          </div>
        ) : null}

        <div id="billing-invoices-section" className="workspace-mini-card billing-invoice-shell">
          <div className="billing-payment-card-head">
            <div>
              <h4>Invoices</h4>
              <p>Scrollable invoice history with full payment details and PDF download.</p>
            </div>
            <span className="billing-status-pill">{billingInvoices.length} saved</span>
          </div>

          {billingLoading ? <p className="tool-copy">Loading invoices...</p> : null}
          {!billingLoading && billingInvoices.length === 0 ? (
            <div className="workspace-mini-card"><p>No invoices available yet.</p></div>
          ) : null}

          {!billingLoading && billingInvoices.length > 0 ? (
            <div className="billing-invoice-scroll">
              {billingInvoices.map((invoice) => (
                <article key={invoice.invoiceNumber} className="billing-invoice-card">
                  <div className="billing-invoice-hero">
                    <div>
                      <span className="billing-invoice-kicker">Invoice #{invoice.invoiceNumber}</span>
                      <h4>{invoice.planName}</h4>
                      <p>{invoice.companyName}</p>
                    </div>
                    <div className="billing-invoice-total">
                      <strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: invoice.currency, maximumFractionDigits: 0 }).format(invoice.amount / 100)}</strong>
                      <span>{invoice.billingCycle}</span>
                    </div>
                  </div>

                  <div className="billing-invoice-grid">
                    <div className="billing-invoice-detail"><span>Customer</span><strong>{invoice.customerName}</strong></div>
                    <div className="billing-invoice-detail"><span>Member ID</span><strong>{invoice.customerCode || "Not available"}</strong></div>
                    <div className="billing-invoice-detail"><span>Email</span><strong>{invoice.customerEmail}</strong></div>
                    <div className="billing-invoice-detail"><span>Mobile</span><strong>{invoice.customerMobile}</strong></div>
                    <div className="billing-invoice-detail"><span>Transaction ID</span><strong>{invoice.transactionCode}</strong></div>
                    <div className="billing-invoice-detail"><span>Status</span><strong>{invoice.status}</strong></div>
                    <div className="billing-invoice-detail"><span>Razorpay Payment ID</span><strong>{invoice.razorpayPaymentId}</strong></div>
                    <div className="billing-invoice-detail"><span>Razorpay Order ID</span><strong>{invoice.razorpayOrderId}</strong></div>
                    <div className="billing-invoice-detail"><span>Activated</span><strong>{new Date(invoice.activatedAt).toLocaleString("en-GB")}</strong></div>
                    <div className="billing-invoice-detail"><span>Valid Till</span><strong>{new Date(invoice.expiresAt).toLocaleString("en-GB")}</strong></div>
                    <div className="billing-invoice-detail"><span>Created</span><strong>{new Date(invoice.createdAt).toLocaleString("en-GB")}</strong></div>
                    <div className="billing-invoice-detail"><span>Canceled At</span><strong>{invoice.canceledAt ? new Date(invoice.canceledAt).toLocaleString("en-GB") : "Not canceled"}</strong></div>
                  </div>

                  <div className="billing-invoice-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => handleDownloadInvoice(invoice.invoiceNumber)}
                      disabled={billingActionLoading === `download-${invoice.invoiceNumber}`}
                    >
                      {billingActionLoading === `download-${invoice.invoiceNumber}` ? "Downloading..." : "Download PDF"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeTab === "region") {
    return (
      <div className="workspace-form-stack">
        <label className="auth-label">Select Timezone</label>
        <select
          className="auth-input workspace-static-input"
          value={storedSettings.region.timezone}
          onChange={(event) =>
            updateStoredSettings((current) => ({
              ...current,
              region: { ...current.region, timezone: event.target.value },
            }))
          }
        >
          <option value="Asia/Kolkata">Asia/Kolkata (India)</option>
          <option value="America/New_York">America/New_York (USA)</option>
          <option value="Europe/London">Europe/London (UK)</option>
          <option value="Asia/Tokyo">Asia/Tokyo (Japan)</option>
        </select>
        <label className="auth-label">Date/Time Format</label>
        <select
          className="auth-input workspace-static-input"
          value={storedSettings.region.dateFormat}
          onChange={(event) =>
            updateStoredSettings((current) => ({
              ...current,
              region: { ...current.region, dateFormat: event.target.value },
            }))
          }
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
        <label className="auth-label">Override Country/Region</label>
        <select
          className="auth-input workspace-static-input"
          value={storedSettings.region.country}
          onChange={(event) =>
            updateStoredSettings((current) => ({
              ...current,
              region: { ...current.region, country: event.target.value },
            }))
          }
        >
          <option>India</option>
          <option>United States</option>
          <option>Germany</option>
          <option>Japan</option>
        </select>
        <button className="primary-button" type="button" onClick={saveRegion}>Save Region & Language</button>
      </div>
    );
  }

  if (activeTab === "support") {
    return (
      <div className="workspace-form-stack">
        <div className="workspace-info-grid">
          <div className="workspace-mini-card"><h4>Help Center</h4><p>Browse guides, onboarding help, and workspace how-to articles.</p></div>
          <div className="workspace-mini-card"><h4>Priority Support</h4><p>Reach the support team for billing, technical, and account assistance.</p></div>
          <div className="workspace-mini-card"><h4>Feature Requests</h4><p>Submit product ideas and improvement requests for future releases.</p></div>
          <div className="workspace-mini-card"><h4>Release Updates</h4><p>See recent improvements, fixes, and updates across the assistant.</p></div>
        </div>
        <button className="primary-button" type="button" onClick={() => setFeedback({ type: "info", text: "Support center is not enabled in this build." })}>Open Support Center</button>
      </div>
    );
  }

  if (activeTab === "terms") {
    return (
      <div className="workspace-form-stack">
        <p className="tool-copy workspace-copy-paragraph">Please review the Terms and Conditions and Privacy Policy. Continuing usage means acceptance of all conditions.</p>
        <button className="primary-button" type="button" onClick={() => setFeedback({ type: "info", text: "Full terms document is not enabled in this build." })}>Read Full Terms</button>
      </div>
    );
  }

  return (
    <div className="workspace-form-stack">
      <div className="workspace-mini-card">
        <p>Resetting will revert local settings in this browser to their default values.</p>
      </div>
      <input
        className="auth-input workspace-static-input"
        placeholder="Enter your password"
        type="password"
        value={resetPassword}
        onChange={(event) => setResetPassword(event.target.value)}
      />
      <button className="primary-button secondary-tone" type="button" onClick={resetAllSettings}>Confirm Reset</button>
    </div>
  );
}

export default SettingsPanel;
