import { apiUrl, requestJson } from "../../shared/api/http";
import { getAuthToken } from "../auth/authStorage";

export async function listCareerOpenings() {
  return requestJson(
    "/careers/openings",
    { method: "GET" },
    "Failed to load career openings."
  );
}

export async function listMyCareerApplications(userId) {
  return requestJson(
    `/careers/applications?userId=${encodeURIComponent(userId)}`,
    { method: "GET" },
    "Failed to load your applications."
  );
}

export async function createCareerOpening(payload) {
  return requestJson(
    "/careers/openings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to save the career opening."
  );
}

export async function updateCareerOpening(openingId, payload) {
  return requestJson(
    `/careers/openings/${encodeURIComponent(openingId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to update the career opening."
  );
}

export async function getCareerManagementOverview() {
  return requestJson(
    "/careers/management/overview",
    { method: "GET" },
    "Failed to load career management overview."
  );
}

export async function updateCareerApplication(applicationId, payload) {
  return requestJson(
    `/careers/applications/admin/${encodeURIComponent(applicationId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to update the application."
  );
}

export async function withdrawCareerApplication(applicationId) {
  return requestJson(
    `/careers/applications/${encodeURIComponent(applicationId)}/withdraw`,
    { method: "PATCH" },
    "Failed to withdraw the application."
  );
}

export async function createCareerApplication(payload) {
  const authToken = getAuthToken();
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    formData.append(key, value);
  });

  const response = await fetch(apiUrl("/careers/applications"), {
    method: "POST",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: formData,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.detail || "Failed to submit the application.");
  }

  return data;
}

export async function downloadCareerResume(applicationId) {
  const authToken = getAuthToken();
  const response = await fetch(apiUrl(`/careers/applications/${encodeURIComponent(applicationId)}/resume`), {
    method: "GET",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  if (!response.ok) {
    let message = "Failed to download the resume.";
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep fallback.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const header = response.headers.get("Content-Disposition") || "";
  const matchedFileName = header.match(/filename=\"?([^"]+)\"?/i);
  link.href = url;
  link.download = matchedFileName?.[1] || `resume-${applicationId}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
}
