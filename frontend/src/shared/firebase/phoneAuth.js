import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  RecaptchaVerifier,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
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

let recaptchaVerifier = null;
let recaptchaContainerElement = null;

export async function sendFirebaseEmailVerification(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedPassword) {
    throw new Error("Enter the password first, then send the email verification link.");
  }

  let credential;

  try {
    credential = await createUserWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
  } catch (error) {
    if (error?.code !== "auth/email-already-in-use") {
      throw error;
    }

    try {
      credential = await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
    } catch {
      throw new Error("Use the correct password for this email before sending the verification link again.");
    }
  }

  try {
    await sendEmailVerification(credential.user);
  } catch (error) {
    if (error?.code === "auth/too-many-requests") {
      throw new Error("Firebase temporarily blocked repeated email verification requests. Wait and try again.");
    }
    throw error;
  }

  return credential.user;
}

export async function checkFirebaseEmailVerification(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.email !== normalizedEmail) {
    throw new Error("Send the email verification link first.");
  }

  await reload(currentUser);
  if (!currentUser.emailVerified) {
    throw new Error("Open the verification link from the email first, then click Verify.");
  }

  return currentUser;
}

export async function resetFirebaseEmailVerification() {
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
