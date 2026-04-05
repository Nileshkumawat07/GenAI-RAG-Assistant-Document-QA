import { requestJson } from "../../shared/api/http";

function normalizeAuthUser(user) {
  return {
    id: user.id,
    name: user.fullName,
    username: user.username,
    email: user.email,
    mobile: user.mobile,
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
