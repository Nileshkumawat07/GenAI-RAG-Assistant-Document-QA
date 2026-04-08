import { apiUrl, requestJson } from "../../shared/api/http";
import { getAuthToken } from "../auth/authStorage";

export async function getManagementOverview() {
  return requestJson(
    "/management/overview",
    {
      method: "GET",
    },
    "Failed to load management overview."
  );
}

export async function createManagementNote(payload) {
  return requestJson(
    "/management/notes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to save management note."
  );
}

export async function createReplyTemplate(payload) {
  return requestJson(
    "/management/reply-templates",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to create reply template."
  );
}

export async function bulkUpdateManagementRequests(payload) {
  return requestJson(
    "/management/requests/bulk-status",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to update the selected requests."
  );
}

export async function exportManagementReport(format = "csv") {
  const authToken = getAuthToken();
  const response = await fetch(apiUrl(`/management/report?format=${encodeURIComponent(format)}`), {
    method: "GET",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  if (!response.ok) {
    let errorMessage = "Failed to export management report.";
    try {
      const data = await response.json();
      errorMessage = data.detail || errorMessage;
    } catch {
      // Keep fallback message.
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const header = response.headers.get("Content-Disposition") || "";
  const matchedFileName = header.match(/filename=\"?([^"]+)\"?/i);
  link.href = url;
  link.download = matchedFileName?.[1] || `management-report.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1500);
}
