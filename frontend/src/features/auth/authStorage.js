const USERS_STORAGE_KEY = "genai_assistant_users";
const CURRENT_USER_STORAGE_KEY = "genai_assistant_current_user";

function readUsers() {
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function getCurrentUser() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}

export function registerUser(user) {
  const users = readUsers();
  const email = user.email.trim().toLowerCase();
  const username = user.username.trim().toLowerCase();

  const alreadyExists = users.some(
    (entry) =>
      entry.email.trim().toLowerCase() === email ||
      entry.username.trim().toLowerCase() === username
  );

  if (alreadyExists) {
    throw new Error("An account with this email or username already exists.");
  }

  const savedUser = {
    id:
      window.crypto?.randomUUID?.() ||
      `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    fullName: user.fullName.trim(),
    username: user.username.trim(),
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    email,
    alternateEmail: user.alternateEmail.trim(),
    mobile: user.mobile.trim(),
    securityQuestion: user.securityQuestion,
    securityAnswer: user.securityAnswer.trim(),
    referralCode: user.referralCode.trim(),
    password: user.password,
    createdAt: new Date().toISOString(),
  };

  users.push(savedUser);
  writeUsers(users);

  return savedUser;
}

export function authenticateUser(identifier, password) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  const user = readUsers().find(
    (entry) =>
      entry.email.trim().toLowerCase() === normalizedIdentifier ||
      entry.username.trim().toLowerCase() === normalizedIdentifier
  );

  if (!user || user.password !== password) {
    throw new Error("Invalid email/username or password.");
  }

  return user;
}
