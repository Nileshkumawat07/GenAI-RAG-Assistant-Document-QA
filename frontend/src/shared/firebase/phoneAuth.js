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
  if (!password) {
    throw new Error("Create your password before sending the verification email.");
  }

  let credential;

  try {
    credential = await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (error?.code !== "auth/email-already-in-use") {
      throw error;
    }

    credential = await signInWithEmailAndPassword(auth, email, password);
  }

  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function checkFirebaseEmailVerification(email) {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.email !== email) {
    throw new Error("Send the verification email first.");
  }

  await reload(currentUser);
  if (!currentUser.emailVerified) {
    throw new Error("Open the email link first, then click Verify.");
  }

  return currentUser;
}

export async function resetFirebaseEmailVerification(email = "") {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return;
  }

  if (!email || currentUser.email === email) {
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
