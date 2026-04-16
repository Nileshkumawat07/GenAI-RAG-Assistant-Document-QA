import { requestJson } from "../../shared/api/http";

export async function getPublishedContentEntries(pageKey) {
  return requestJson(
    `/content/page/${encodeURIComponent(pageKey)}`,
    { method: "GET" },
    "Failed to load published content."
  );
}

export async function getManageContentEntries(pageKey) {
  return requestJson(
    `/content/manage/${encodeURIComponent(pageKey)}`,
    { method: "GET" },
    "Failed to load editable content."
  );
}

export async function saveManagedContentEntry(payload) {
  return requestJson(
    "/content/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to save content."
  );
}
