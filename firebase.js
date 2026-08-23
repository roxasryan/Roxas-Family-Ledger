import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// ---------------------------------------------------------------------
// PASTE YOUR FIREBASE CONFIG HERE.
// You get this from: Firebase console -> Project settings -> General ->
// "Your apps" -> the web app (</>) -> SDK setup and configuration.
// It's fine for this to be public/visible in your code — Firebase API
// keys identify the project, they aren't secret. Real protection comes
// from the Firestore security rules you'll set separately (see README).
// ---------------------------------------------------------------------
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAjD2pJmfw57rQDkjM1iSk9c4MT9xIQjdQ",
  authDomain: "roxas-family-ledger.firebaseapp.com",
  projectId: "roxas-family-ledger",
  storageBucket: "roxas-family-ledger.firebasestorage.app",
  messagingSenderId: "512727419788",
  appId: "1:512727419788:web:3bc5ebcd6d1bf080bf64a9",
  measurementId: "G-QTRTSN2BD4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Silent anonymous sign-in. No login screen, no email, no password —
// this just gives the app a session so Firestore rules can require
// "must be signed in" without ever showing you or Blanche a login UI.
export function ensureSignedIn(callback) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      signInAnonymously(auth).catch((e) => console.error('Anonymous sign-in failed', e));
    }
  });
}
