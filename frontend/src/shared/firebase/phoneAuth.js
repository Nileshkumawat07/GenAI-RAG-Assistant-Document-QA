import { initializeApp } from "firebase/app";
import {
  getAuth,
  isSignInWithEmailLink,
  RecaptchaVerifier,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAgDtCP4pQ81Kgtly1r7_vaUK8l7-Rgfjs",
  authDomain: "otpp-2df97.firebaseapp.com",
  projectId: "otpp-2df97",
  storageBucket: "otpp-2df97.firebasestorage.app",
  messagingSenderId: "238444711263",
  appId: "1:238444711263:web:202f3261277396b9223aea",
  measurementId: "G-49L4H5R7PS",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const EMAIL_LINK_STORAGE_KEY = "firebase_email_link_target";
const EMAIL_VERIFIED_STORAGE_KEY = "firebase_verified_email_map";

let recaptchaVerifier = null;
let recaptchaContainerElement = null;

export async function sendFirebaseEmailVerification(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const actionCodeSettings = {
    url: `${window.location.origin}${window.location.pathname}#/signup`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);
  } catch (error) {
    if (error?.code === "auth/invalid-continue-uri" || error?.code === "auth/unauthorized-continue-uri") {
      throw new Error("Add this app URL to Firebase authorized domains before sending the email link.");
    }
    throw error;
  }

  storeEmailForLink(normalizedEmail);
  setEmailVerifiedState(normalizedEmail, false);
  return normalizedEmail;
}

export async function consumeFirebaseEmailVerificationLink(currentUrl) {
  if (!isSignInWithEmailLink(auth, currentUrl)) {
    return null;
  }

  const storedEmail = getStoredEmailForLink();
  if (!storedEmail) {
    throw new Error("Open the email link on the same device where you requested it.");
  }

  const result = await signInWithEmailLink(auth, storedEmail, currentUrl);
  setEmailVerifiedState(storedEmail, true);
  clearEmailForLink();
  await signOut(auth);
  return result.user?.email || storedEmail;
}

export async function checkFirebaseEmailVerification(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isEmailVerifiedState(normalizedEmail)) {
    throw new Error("Open the email link first, then click Verify.");
  }

  return normalizedEmail;
}

export async function resetFirebaseEmailVerification(email = "") {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail) {
    setEmailVerifiedState(normalizedEmail, false);
  }

  clearEmailForLink();

  const currentUser = auth.currentUser;
  if (currentUser) {
    await signOut(auth);
  }
}

export async function sendFirebaseOtp(phoneNumber, containerId) {
  await resetFirebaseRecaptcha(containerId);
  const actualContainerId = ensureRecaptchaContainer(containerId);
  const verifier = new RecaptchaVerifier(auth, actualContainerId, {
    size: "invisible",
  });
  recaptchaVerifier = verifier;
  await verifier.render();
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyFirebaseOtp(confirmationResult, otpCode) {
  const result = await confirmationResult.confirm(otpCode);
  await signOut(auth);
  return result;
}

export async function resetFirebaseRecaptcha(containerId) {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } finally {
      recaptchaVerifier = null;
    }
  }

  if (recaptchaContainerElement?.parentNode) {
    recaptchaContainerElement.parentNode.removeChild(recaptchaContainerElement);
  }
  recaptchaContainerElement = null;

  if (containerId && typeof document !== "undefined") {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = "";
    }
  }
}

function ensureRecaptchaContainer(containerId) {
  if (typeof document === "undefined") {
    return containerId;
  }

  const hostElement = document.getElementById(containerId);
  if (!hostElement) {
    return containerId;
  }

  const childElement = document.createElement("div");
  childElement.id = `${containerId}-inner-${Date.now()}`;
  hostElement.innerHTML = "";
  hostElement.appendChild(childElement);
  recaptchaContainerElement = childElement;
  return childElement.id;
}

function storeEmailForLink(email) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
}

function getStoredEmailForLink() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY) || "";
}

function clearEmailForLink() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
}

function readVerifiedEmailMap() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(EMAIL_VERIFIED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setEmailVerifiedState(email, verified) {
  if (typeof window === "undefined") {
    return;
  }

  const map = readVerifiedEmailMap();
  map[email] = verified;
  window.localStorage.setItem(EMAIL_VERIFIED_STORAGE_KEY, JSON.stringify(map));
}

function isEmailVerifiedState(email) {
  const map = readVerifiedEmailMap();
  return Boolean(map[email]);
}
