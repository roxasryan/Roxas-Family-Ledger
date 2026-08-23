import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// ---------------------------------------------------------------------
// A single fixed "household" document path. This isn't a username or
// account — it's just a bucket name for your data in Firestore. Change
// this to something private (not "roxas-family") before you deploy, and
// use the exact same value in your Firestore security rules (see
// README). This is a privacy speed bump, same spirit as the app's PIN —
// not bulletproof security, but it keeps casual visitors from landing
// on your data by guessing an obvious path.
// ---------------------------------------------------------------------
const HOUSEHOLD_ID = 'REPLACE_WITH_YOUR_OWN_PRIVATE_ID';

function sharedDocRef(key) {
  return doc(db, 'households', HOUSEHOLD_ID, 'shared', key);
}

// Subscribes to a shared key. Calls `callback(value, error)` immediately
// with the current value (or null if it doesn't exist yet, or on error),
// and again every time either device changes it — this is what gives
// real-time sync instead of polling. Returns an unsubscribe function.
//
// Important: the error case still calls `callback`, just with an error
// attached. If it didn't, a misconfigured Firestore rule or a missing
// anonymous-auth setup would leave the app waiting forever with no
// visible sign anything was wrong.
export function subscribeShared(key, callback) {
  return onSnapshot(
    sharedDocRef(key),
    (snap) => callback(snap.exists() ? snap.data().value : null, null),
    (error) => { console.error('Subscribe failed for', key, error); callback(null, error); }
  );
}

export async function setShared(key, value) {
  try {
    await setDoc(sharedDocRef(key), { value, updatedAt: Date.now() });
  } catch (e) {
    console.error('Save failed for', key, e);
  }
}

// Personal (per-device) data never needs to sync between phones, so it
// just lives in this browser's localStorage — no network round trip.
export function getPersonal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setPersonal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('Local save failed for', key, e);
  }
}
