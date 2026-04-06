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
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
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
