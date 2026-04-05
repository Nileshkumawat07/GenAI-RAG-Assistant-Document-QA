import { getApp, getApps, initializeApp } from "firebase/app";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAgDtCP4pQ81Kgtly1r7_vaUK8l7-Rgfjs",
  authDomain: "otpp-2df97.firebaseapp.com",
  projectId: "otpp-2df97",
  storageBucket: "otpp-2df97.firebasestorage.app",
  messagingSenderId: "238444711263",
  appId: "1:238444711263:web:202f3261277396b9223aea",
  measurementId: "G-49L4H5R7PS",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function saveContactSubmission(payload) {
  const document = {
    ...payload,
    createdAt: serverTimestamp(),
  };

  const result = await addDoc(collection(db, "contactSubmissions"), document);
  return result.id;
}
