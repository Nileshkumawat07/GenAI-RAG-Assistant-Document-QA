import { requestJson } from "../../shared/api/http";

export async function getAdminCenterOverview() {
  return requestJson(
    "/admin-center/overview",
    { method: "GET" },
    "Failed to load administration center."
  );
}

export async function updateAdminUser(userId, payload) {
  return requestJson(
    `/admin-center/users/${encodeURIComponent(userId)}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to update the user."
  );
}

export async function lockAdminUser(userId, payload = {}) {
  return requestJson(
    `/admin-center/users/${encodeURIComponent(userId)}/lock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to lock the user."
  );
}

export async function reactivateAdminUser(userId, payload = {}) {
  return requestJson(
    `/admin-center/users/${encodeURIComponent(userId)}/reactivate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to reactivate the user."
  );
}

export async function forceAdminPasswordReset(userId) {
  return requestJson(
    `/admin-center/users/${encodeURIComponent(userId)}/force-password-reset`,
    { method: "POST" },
    "Failed to require a password reset."
  );
}

export async function assignAdminRole(payload) {
  return requestJson(
    "/admin-center/roles/assign",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to assign role."
  );
}

export async function updateBillingAdministration(payload) {
  return requestJson(
    "/admin-center/billing/update",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to update billing administration."
  );
}

export async function saveAdminContent(payload) {
  return requestJson(
    "/admin-center/content/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to save content."
  );
}

export async function createAdminCommunicationTemplate(payload) {
  return requestJson(
    "/admin-center/communications/templates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to create communication template."
  );
}

export async function runAdminDatabaseQuery(payload) {
  return requestJson(
    "/admin-center/database/query",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to run the database query."
  );
}
