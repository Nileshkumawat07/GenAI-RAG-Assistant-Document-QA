const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const AUTH_TOKEN_STORAGE_KEY = "genai_assistant_auth_token";

export function apiUrl(path) {
  return `${API_BASE}${path}`;
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
      throw new Error(data.detail || fallbackMessage);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Connection failed.");
    }

    throw error;
  }
}
