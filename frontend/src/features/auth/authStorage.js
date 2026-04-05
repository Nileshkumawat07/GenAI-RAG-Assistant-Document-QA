const CURRENT_USER_STORAGE_KEY = "genai_assistant_current_user";
const AUTH_TOKEN_STORAGE_KEY = "genai_assistant_auth_token";

export function getCurrentUser() {
  try {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    const raw = window.sessionStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  window.sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  if (user?.authToken) {
    window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, user.authToken);
  } else {
    window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

export function clearCurrentUser() {
  window.sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}

export function getAuthToken() {
  try {
    return window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
