# Dinner planning

A recipe-library-first dinner planner for two people in New Zealand. The browser app selects from a maintained recipe catalogue, balances variety and ingredient reuse, builds shopping totals, and syncs private household planning data through Firebase.

## Architecture at a glance

There is no framework, package-manager install, bundler, or application server in the production path. GitHub Pages serves a static HTML/CSS/JavaScript app; browser ES modules contain the UI and planning logic, and recipe Markdown is compiled to static JSON.

| Path | Responsibility |
| --- | --- |
| `index.html`, `styles.css` | Static shell, import map, and presentation |
| `app.js` | UI state, rendering, interactions, and integration |
| `planner.mjs` | Pure suggestion, validation, totals, and shopping-list logic |
| `cloud-store.mjs` | Firebase authentication and versioned record persistence |
| `recipes/<group>/*.md` | Human-readable recipe cards and embedded `recipe-data` metadata |
| `data/ingredients.json` | Canonical ingredient units and estimated NZ pack sizes |
| `data/recipes.json` | Generated recipe catalogue consumed by the app |
| `preferences.md`, `feedback.md` | Household constraints and durable cooking feedback |
| `weeks/` | Dated planning exports and snapshots; not loaded by the app |
| `tests/` | Node unit tests, Python builder tests, and Firestore integration tests |

The main data flow is:

```text
recipes/**/*.md + data/ingredients.json
                 |
                 v
        scripts/build-data.py
                 |
                 v
         data/recipes.json --> browser app --> Firebase household records
```

`data/recipes.json` and the version query strings in `index.html` are generated outputs. Edit their sources, then run the appropriate script instead of changing them by hand.

## Run locally

Prerequisites are Python 3 and a current Node.js release (the deployment workflow uses Node 22). Normal local development needs no dependency installation.

```sh
python3 scripts/build-data.py
node scripts/dev-server.mjs
```

Open [http://localhost:8000](http://localhost:8000). Serving `index.html` directly from the filesystem is not supported.

To auto-unlock during local browser testing, copy `.env.example` to `.env.local` and set `COOKING_HOUSEHOLD_PASSWORD`. The development server exposes it only through a loopback-only endpoint. The ignored file must never be committed. Without it, use the normal unlock form; Firebase browser persistence keeps an existing session signed in.

## Planning in the app

1. Choose **Plan a week**, a date, and the number of dinners. Four is the default, but any positive whole-number count is supported.
2. Search or filter the library and add dinners. **Suggest remaining dinners** preserves current selections and fills open slots while balancing protein families and cuisine variety and avoiding the latest two earlier weeks. **Swap** evaluates the whole week and rotates through recently explored alternatives. Ingredient reuse is a tie-breaker; suggestions never create recipes.
3. Review ingredient reuse and shopping totals. Tick ingredients off as you shop; checklist state is saved with the draft or week. Pack sizes are editable estimates rather than live supermarket listings. Pantry items are a check before buying. Reducing the dinner count preserves selections until extras are removed.
4. Unlock with the shared household password and save. Drafts, saved weeks, feedback, tried status, comments, and favourites sync through Firebase as private household data; they are not published from this repository.
5. Open any saved week and choose **Edit week** to change its dinners, count, date, or pack-size estimates. Saving recalculates its shopping list and updates the saved week while preserving feedback; changing to another occupied date is blocked.
6. Existing dates cannot be overwritten from the date picker when creating a new plan.

A recipe marked **Not yet cooked** is not claimed to be tested. After cooking, use **Mark as tried**, record household feedback, and update the repository recipe separately if the shared card should change. Comments and favourites are stored independently of saved plan snapshots, so they follow a recipe across plans and catalogue updates.

## Recipe and planning records

Recipe cards live under `recipes/` and contain a `recipe-data` JSON comment with a stable ID, cuisine, protein, servings, active minutes, equipment, cooking status, and ingredient amounts. Keep this block aligned with the readable recipe. Every dinner serves two and allows at most 30 minutes of active cooking, though elapsed cooking time may be longer.

Ingredient keys must exist in `data/ingredients.json`. Amount conventions include dry weight for rice, drained weight for chickpeas (240 g per estimated 400 g can), and an estimate of 10 cloves per garlic bulb. Run the data builder after changing recipe cards or the ingredient catalogue and commit the regenerated `data/recipes.json`.

Saved plan JSON includes full recipe snapshots, so later catalogue edits do not change a saved plan's recipes or shopping list. Files in `weeks/` are planning history and backups only. Copy useful post-cooking notes into `feedback.md` for future plans; make lasting recipe improvements as a separate change.

## Verification guide

Run the checks that cover the changed area:

| Change | Required verification |
| --- | --- |
| Planning or cloud-store logic | `node --test tests/*.test.mjs` |
| Recipe cards or ingredient catalogue | `python3 tests/build-data.test.py`, then `python3 scripts/build-data.py` |
| Browser JavaScript, CSS, Firebase config, or imports | Relevant tests, a local browser check, then `./scripts/bust-cache.sh` |
| Firestore record contract or rules | Unit tests plus the emulator-backed integration test described below |
| Documentation only | Review the rendered Markdown and links; no generated-data rebuild is needed |

The full fast test suite is:

```sh
node --test tests/*.test.mjs
python3 tests/build-data.test.py
```

`tests/firestore.integration.mjs` documents its additional dependencies. Install `firebase@12.18.0` and `@firebase/rules-unit-testing@5.0.0` in a temporary directory, set `FIREBASE_TEST_MODULES` to that directory's `node_modules`, and run the test with:

```sh
firebase emulators:exec --only firestore --project demo-dinner-sorted \
  'node --test tests/firestore.integration.mjs'
```

Enable the repository's cache-key pre-commit hook with:

```sh
git config core.hooksPath .githooks
```

The hook updates `index.html` when staged changes touch `app.js`, `planner.mjs`, or `styles.css`. Run `./scripts/bust-cache.sh` yourself for changes to `cloud-store.mjs` or `firebase-config.json` as well.

## Publishing and Firestore rules

Publish the repository root with GitHub Pages. `.github/workflows/cache-bust.yml` provides a fallback that updates browser asset cache keys after relevant pushes to `main`.

`.github/workflows/deploy-firestore-rules.yml` deploys `firestore.rules` to the `dinner-sorted-afff4` Firebase project after pushes to `main` that change the rules, Firebase configuration, or the app's Firestore contract. It can also be run manually. The workflow requires these GitHub Actions secrets:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: the full Google Cloud Workload Identity Provider resource name for this repository.
- `GCP_SERVICE_ACCOUNT`: a trusted Google service account with permission to create and update Firebase Rules releases.

The workflow uses short-lived Google credentials and a pinned Firebase CLI version. Keep `firestore.rules` as the source of truth; a later deployment overwrites console-only rule edits.
