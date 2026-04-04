import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut } from "firebase/auth";

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

export function getPhoneAuth() {
  return auth;
}

export function getOrCreateRecaptcha(containerId) {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
  });

  return recaptchaVerifier;
}

export async function sendFirebaseOtp(phoneNumber, containerId) {
  const verifier = getOrCreateRecaptcha(containerId);
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyFirebaseOtp(confirmationResult, otpCode) {
  const result = await confirmationResult.confirm(otpCode);
  await signOut(auth);
  return result;
}

export async function resetFirebaseRecaptcha() {
  if (!recaptchaVerifier) {
    return;
  }

  try {
    await recaptchaVerifier.clear();
  } finally {
    recaptchaVerifier = null;
  }
}
