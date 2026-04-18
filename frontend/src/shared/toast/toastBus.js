export function pushToast(message, type = "info", options = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = typeof message === "string"
    ? { message, type, ...options }
    : { type, ...message, ...options };

  window.dispatchEvent(new CustomEvent("genai-toast", { detail }));
}

