import { requestJson } from "../../shared/api/http";

function normalizeAuthUser(user) {
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
    mode: "member",
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
