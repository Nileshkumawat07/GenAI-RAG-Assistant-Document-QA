import { requestJson } from "../../shared/api/http";
import { getAuthToken } from "../auth/authStorage";
import { normalizeAuthUser } from "../auth/authApi";

export async function listInvoices() {
  return requestJson(
    "/payments/invoices",
    {
      method: "GET",
    },
    "Failed to load invoices."
  );
}

export async function cancelSubscription() {
  const data = await requestJson(
    "/payments/subscription/cancel",
    {
      method: "POST",
    },
    "Failed to cancel subscription."
  );

  return {
    ...data,
    user: data.user ? normalizeAuthUser(data.user) : null,
  };
}

export async function downloadInvoicePdf(invoiceNumber) {
  const authToken = getAuthToken();
  const response = await fetch(`/payments/invoices/${invoiceNumber}/pdf`, {
    method: "GET",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  if (!response.ok) {
    let errorMessage = "Failed to download invoice PDF.";
    try {
      const data = await response.json();
      errorMessage = data.detail || errorMessage;
    } catch {
      // Keep the fallback message when a JSON error body is not available.
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
