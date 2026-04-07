import { apiUrl, requestJson } from "../../shared/api/http";
import { getAuthToken } from "./authStorage";

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

export async function downloadAdministrationExport(section, format = "csv") {
  const authToken = getAuthToken();
  const response = await fetch(
    apiUrl(`/auth/settings/admin/export?section=${encodeURIComponent(section)}&format=${encodeURIComponent(format)}`),
    {
      method: "GET",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    }
  );

  if (!response.ok) {
    let errorMessage = "Failed to export administration data.";
    try {
      const data = await response.json();
      errorMessage = data.detail || errorMessage;
    } catch {
      // Keep the fallback message.
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const header = response.headers.get("Content-Disposition") || "";
  const matchedFileName = header.match(/filename=\"?([^"]+)\"?/i);
  link.href = url;
  link.download = matchedFileName?.[1] || `admin-${section}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1500);
}

export async function downloadAccountDataPdf(password) {
  const authToken = getAuthToken();
  const response = await fetch(apiUrl("/auth/settings/data-export/pdf"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    let errorMessage = response.status === 400 || response.status === 401
      ? "Wrong password. Please enter your current password."
      : "Failed to download account data PDF.";
    try {
      const responseText = await response.text();
      if (responseText) {
        try {
          const data = JSON.parse(responseText);
          errorMessage = data.detail || errorMessage;
        } catch {
          if (/incorrect|invalid|wrong password/i.test(responseText)) {
            errorMessage = "Wrong password. Please enter your current password.";
          }
        }
      }
    } catch {
      // Keep the most helpful fallback available.
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
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1500);
}

export async function deleteAccount(payload) {
  return requestJson(
    "/auth/settings/delete-account",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to delete account."
  );
}
