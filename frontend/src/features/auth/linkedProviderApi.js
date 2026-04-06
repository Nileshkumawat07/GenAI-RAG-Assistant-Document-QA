import { apiUrl, requestJson } from "../../shared/api/http";

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

export async function authorizeLinkedProvider(providerKey, frontendOrigin) {
  const popup = window.open(
    "about:blank",
    `link-${providerKey}`,
    "width=620,height=760,menubar=no,toolbar=no,status=no"
  );

  if (!popup) {
    throw new Error("Popup was blocked. Allow popups for this site and try again.");
  }

  try {
    popup.document.write(`<p style="font-family:Segoe UI,sans-serif;padding:16px">Opening ${providerKey} sign-in...</p>`);
  } catch {}

  let data;
  try {
    data = await requestJson(
      `/linked-providers/${encodeURIComponent(providerKey)}/authorize-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ frontendOrigin }),
      },
      `Failed to start ${providerKey} sign-in.`
    );
  } catch (error) {
    try {
      popup.close();
    } catch {}
    throw error;
  }

  try {
    popup.location.replace(data.authorizeUrl);
  } catch {
    popup.close();
    throw new Error(`Failed to open ${providerKey} sign-in window.`);
  }

  return new Promise((resolve, reject) => {
    const expectedOrigin = new URL(apiUrl("/"), window.location.origin).origin;
    const timeoutId = window.setTimeout(() => {
      cleanup();
      try {
        popup.close();
      } catch {}
      reject(new Error("Provider sign-in timed out. Please try again."));
    }, 120000);

    const closedCheck = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Provider sign-in was closed before validation completed."));
      }
    }, 500);

    const onMessage = (event) => {
      if (event.origin !== expectedOrigin) {
        return;
      }

      const payload = event.data || {};
      if (payload.source !== "provider-link" || payload.providerKey !== providerKey) {
        return;
      }

      cleanup();
      if (!payload.success) {
        try {
          popup.close();
        } catch {}
        reject(new Error(payload.message || `Failed to validate ${providerKey}.`));
        return;
      }

      resolve({
        userId: payload.userId || "",
        provider: payload.provider || providerKey,
        providerId: payload.providerId || "",
        email: payload.email || "",
        displayName: payload.displayName || "",
      });
    };

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.clearInterval(closedCheck);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
  });
}

export async function unlinkProvider(providerKey, payload) {
  return requestJson(
    `/linked-providers/${encodeURIComponent(providerKey)}`,
    {
      method: "DELETE",
    },
    `Failed to unlink ${providerKey}.`
  );
}
