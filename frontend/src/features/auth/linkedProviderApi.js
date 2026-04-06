import { requestJson } from "../../shared/api/http";

export async function listLinkedProviders() {
  return requestJson(
    "/linked-providers",
    {
      method: "GET",
    },
    "Failed to load linked providers."
  );
}

export async function linkProvider(providerKey, payload) {
  return requestJson(
    `/linked-providers/${encodeURIComponent(providerKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    `Failed to link ${providerKey}.`
  );
}

export async function unlinkProvider(providerKey, payload) {
  return requestJson(
    `/linked-providers/${encodeURIComponent(providerKey)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    `Failed to unlink ${providerKey}.`
  );
}
