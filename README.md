# Roxas Family Ledger — self-hosted setup

This is the same app, rebuilt to run on GitHub Pages with Firebase instead of
Claude's artifact hosting. No Claude account needed for either of you, and
you get a real home screen icon this time.

There are two services to set up before this works: **GitHub** (hosting)
and **Firebase** (the shared database). Do them in order.

## 1. Create the GitHub repo

1. Go to github.com and sign in (or create a free account).
2. Click the **+** in the top right → **New repository**.
3. Name it `roxas-ledger` (matters — see the note below if you pick a
   different name).
4. Set it to **Public** (GitHub Pages on a free account requires this —
   your *data* isn't in the repo, only app code, so this is fine).
5. Click **Create repository**.
6. On the new repo's page, click **uploading an existing file**, then drag
   in every file and folder from this project (keep the folder structure —
   `.github/workflows/deploy.yml` needs to stay in that exact path).
7. Commit the files.

**If you name the repo something other than `roxas-ledger`**, update the
base path in two places before uploading:
- `vite.config.js` → the `base:` value
- `public/manifest.json` → `start_url` and `scope`

All three must match your repo name exactly, with a `/` on both ends.

## 2. Turn on GitHub Pages

1. In your repo, go to **Settings → Pages**.
2. Under "Build and deployment" → **Source**, choose **GitHub Actions**.
3. That's it — the workflow file already in this project handles the rest.

The first deploy will fail (Firebase isn't configured yet) — that's
expected, keep going.

## 3. Create a free Firebase project

1. Go to console.firebase.google.com and sign in with any Google account.
2. **Add project** → name it anything → you can skip Google Analytics.
3. Once created, click the **</>** (web) icon to register a web app.
   Give it any nickname, skip Firebase Hosting (you're using GitHub Pages).
4. You'll see a `firebaseConfig` object with fields like `apiKey`,
   `authDomain`, etc. Copy all of it.
5. Open `src/firebase.js` in this project and paste your values in over
   the `REPLACE_ME` placeholders.

## 4. Turn on Firestore (the database)

1. In the Firebase console, left sidebar → **Build → Firestore Database**.
2. Click **Create database**. Choose a region close to you. Start in
   **production mode**.
3. Go to the **Rules** tab and replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{householdId}/shared/{key} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **Publish**.

## 5. Turn on anonymous sign-in

This gives the app a silent session — no login screen, ever — which is
what the rule above checks for.

1. Left sidebar → **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous**.

## 6. Pick a private household ID

Open `src/storage.js` and change `HOUSEHOLD_ID` from the placeholder to
something private — not literally "roxas-family". A random string works
well, e.g. `roxas-8f3k2m`. Not real security (same honest caveat as the
app's PIN feature) — just keeps casual visitors from landing on your data
by guessing an obvious name.

## 7. Push these changes and deploy

Upload the updated `src/firebase.js` and `src/storage.js` back to your
GitHub repo (same drag-and-drop upload flow as step 1, or use `git push`
if you're comfortable with it). Every push to `main` automatically
rebuilds and redeploys — check the **Actions** tab in your repo to watch
it happen and see the live URL once it's done (something like
`https://yourusername.github.io/roxas-ledger/`).

## 8. Restore your data

Open the new URL, go to **Settings → Backup & data → Import backup**, and
select your `.json` backup file. Everything comes back — categories,
expenses, payment methods, household members, PIN, and security question.

## 9. Add to home screen and share

Same as before: Safari → Share → Add to Home Screen. This time it'll use
the real "R" icon, and there's no account for Blanche to create — the
link just works.

---

**If a deploy fails**, click into the failed run under the **Actions** tab
in your repo, open the red step, and copy the error text — send it over
and it can be fixed from there.
