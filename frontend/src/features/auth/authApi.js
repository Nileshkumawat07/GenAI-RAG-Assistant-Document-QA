import { requestJson } from "../../shared/api/http";

export function normalizeAuthUser(user) {
  return {
    id: user.id,
    name: user.fullName,
    username: user.username,
    fullName: user.fullName,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    email: user.email,
    alternateEmail: user.alternateEmail,
    mobile: user.mobile,
    securityQuestion: user.securityQuestion,
    securityAnswer: user.securityAnswer,
    referralCode: user.referralCode,
    publicUserCode: user.publicUserCode || null,
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
    subscriptionPlanId: user.subscriptionPlanId || null,
    subscriptionPlanName: user.subscriptionPlanName || null,
    subscriptionStatus: user.subscriptionStatus || "free",
    subscriptionAmount: user.subscriptionAmount ?? null,
    subscriptionCurrency: user.subscriptionCurrency || null,
    subscriptionBillingCycle: user.subscriptionBillingCycle || null,
    subscriptionActivatedAt: user.subscriptionActivatedAt || null,
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    createdAt: user.createdAt,
    authToken: user.authToken,
    isAdmin: !!user.isAdmin,
    mode: user.mode || (user.isAdmin ? "admin" : "member"),
  };
}

export async function signupUser(payload) {
  const data = await requestJson(
    "/auth/signup",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to create account."
  );

  return normalizeAuthUser(data);
}

export async function loginUser(payload) {
  const data = await requestJson(
    "/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to log in."
  );

  return normalizeAuthUser(data);
}

export async function updateUsername(payload) {
  const data = await requestJson(
    "/auth/settings/username",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to update username."
  );

  return normalizeAuthUser(data);
}

export async function updateEmail(payload) {
  const data = await requestJson(
    "/auth/settings/email",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to update email."
  );

  return normalizeAuthUser(data);
}

export async function updateMobile(payload) {
  const data = await requestJson(
    "/auth/settings/mobile",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to update mobile number."
  );

  return normalizeAuthUser(data);
}

export async function changePassword(payload) {
  return requestJson(
    "/auth/settings/password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to update password."
  );
}

export async function getAdminMysqlOverview() {
  return requestJson(
    "/auth/settings/admin/mysql-overview",
    {
      method: "GET",
    },
    "Failed to load MySQL overview."
  );
}

export async function downloadAccountDataPdf() {
  const authToken = window.sessionStorage.getItem("genai_assistant_auth_token");
  const response = await fetch("/auth/settings/data-export/pdf", {
    method: "GET",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  if (!response.ok) {
    let errorMessage = "Failed to download account data PDF.";
    try {
      const data = await response.json();
      errorMessage = data.detail || errorMessage;
    } catch {
      // Keep fallback message for non-JSON responses.
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const header = response.headers.get("Content-Disposition") || "";
  const matchedFileName = header.match(/filename=\"?([^"]+)\"?/i);
  link.href = url;
  link.download = matchedFileName?.[1] || "account-data-export.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
