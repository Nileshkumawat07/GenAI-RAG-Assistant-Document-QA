const CURRENT_USER_STORAGE_KEY = "genai_assistant_current_user";

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
}

export function clearCurrentUser() {
  window.sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}
