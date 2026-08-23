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
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
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
