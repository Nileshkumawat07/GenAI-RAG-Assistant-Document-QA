import { requestJson } from "../../shared/api/http";

export async function createContactRequest(payload) {
  return requestJson(
    "/contact-requests",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to create contact request."
  );
}

export async function listContactRequests(userId) {
  return requestJson(
    `/contact-requests?userId=${encodeURIComponent(userId)}`,
    {
      method: "GET",
    },
    "Failed to load contact requests."
  );
}

export async function updateContactRequestStatus(requestId, payload) {
  return requestJson(
    `/contact-requests/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to update contact request."
  );
}

export async function deleteContactRequest(requestId, userId) {
  return requestJson(
    `/contact-requests/${encodeURIComponent(requestId)}?userId=${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    },
    "Failed to delete contact request."
  );
}
