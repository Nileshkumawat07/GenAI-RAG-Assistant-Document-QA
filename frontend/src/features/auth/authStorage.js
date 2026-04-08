const CURRENT_USER_STORAGE_KEY = "genai_assistant_current_user";
const AUTH_TOKEN_STORAGE_KEY = "genai_assistant_auth_token";
const AUTH_NOTICE_STORAGE_KEY = "genai_assistant_auth_notice";

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

export function setAuthNotice(message) {
  try {
    if (message) {
      window.sessionStorage.setItem(AUTH_NOTICE_STORAGE_KEY, message);
    } else {
      window.sessionStorage.removeItem(AUTH_NOTICE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
}

export function getAuthNotice() {
  try {
    return window.sessionStorage.getItem(AUTH_NOTICE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearAuthNotice() {
  try {
    window.sessionStorage.removeItem(AUTH_NOTICE_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
