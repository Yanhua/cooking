# Shared household cloud saving

The frontend stays on GitHub Pages. Firebase Spark supplies Authentication and Firestore; no Cloud Functions, paid billing, Analytics or Firebase Hosting are required.

## Connect a Firebase project

1. Create a **Spark** project in the [Firebase console](https://console.firebase.google.com/). Disable Google Analytics.
2. Register a web app. Copy its public `apiKey`, `authDomain`, `projectId` and `appId` into `firebase-config.json`.
3. Enable Authentication → Email/Password. Create **one** household user in the Users tab with an email you control and the shared password. The household types only the password in this app; keep it out of source files and chat.
4. Put that user's email and UID into `householdEmail` and `householdUid` in `firebase-config.json`. The email and UID are public identifiers, not secrets. Use a dedicated email alias if preferred.
5. Create a **Standard edition** Firestore database in production mode. Choose a nearby region (Sydney is suitable for New Zealand).
6. Replace `REPLACE_WITH_HOUSEHOLD_UID` in `firestore.rules` with the same UID and publish the rules in Firestore → Rules. The rules restrict all data access to that one UID, even if someone creates another Firebase account through the public API. Unmatched paths and hard deletes are denied.
7. Add the GitHub Pages hostname to Authentication → Settings → Authorized domains. Add `localhost` if needed for local development.
8. Run `./scripts/bust-cache.sh`, publish the static files using the existing GitHub Pages workflow, and unlock the app on each device.

Alternatively deploy rules with `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`. The checked-in `firebase.json` intentionally has no Hosting configuration.

## Existing saves and behavior

After unlocking, **Import this browser’s old saves** copies weeks, a draft and tried statuses only where corresponding cloud records do not exist. Existing cloud records and deletion tombstones win; original browser copies remain available. Run import on each browser containing old saves. Import does not automatically alter repository files or recipe cards.

Cloud records preserve the existing JSON export format, including recipe snapshots and nested arrays. Feedback changes do not alter snapshots. Saves are atomic and use revision checks; a stale edit is rejected with a reload action instead of overwriting another device. An internet connection is required to load and save household data. Failed saves are never labelled successful. No offline write queue or persistent Firestore cache is enabled.

The app remembers the Firebase session in the browser, not the password. **Lock planner** signs this browser out and clears household data from the app's memory. It does not log out other devices or erase older, pre-migration browser saves. Static recipe files and published repository plans remain publicly accessible; the password protects private cloud data, not GitHub Pages assets.

JSON exports remain available for backups. Cloud saves do not commit themselves to the repository. Change the shared password in Firebase's account management when needed; password recovery uses the household email outside this app.

## Verify

```sh
node --test tests/planner.test.mjs tests/cloud-store.test.mjs
python3 tests/build-data.test.py
```

Before publishing, verify wrong-password rejection, lock/reload behavior, cloud save/read on two devices, feedback, tried status, legacy import, conflict rejection and signed-out database denial.
