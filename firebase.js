import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAjD2pJmfw57rQDkjM1iSk9c4MT9xIQjdQ",
  authDomain: "roxas-family-ledger.firebaseapp.com",
  projectId: "roxas-family-ledger",
  storageBucket: "roxas-family-ledger.firebasestorage.app",
  messagingSenderId: "512727419788",
  appId: "1:512727419788:web:3bc5ebcd6d1bf080bf64a9",
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
