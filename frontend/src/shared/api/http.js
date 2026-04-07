const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const AUTH_TOKEN_STORAGE_KEY = "genai_assistant_auth_token";

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function extractErrorMessage(detail, fallbackMessage) {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const firstMessage = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item.msg || item.message || item.detail || "";
        }
        return "";
      })
      .find(Boolean);
    if (firstMessage) {
      return firstMessage;
    }
  }

  if (detail && typeof detail === "object") {
    return detail.message || detail.msg || detail.detail || fallbackMessage;
  }

  return fallbackMessage;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function requestJson(path, options, fallbackMessage) {
  try {
    const nextOptions = { ...(options || {}) };
    const headers = new Headers(nextOptions.headers || {});
    const authToken = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (authToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    nextOptions.headers = headers;

    const response = await fetch(apiUrl(path), nextOptions);
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(extractErrorMessage(data.detail, fallbackMessage));
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Connection failed.");
    }

    throw error;
  }
}
