# Cooking project instructions

This repository is both a static dinner-planning app and a reusable recipe library for a two-person household in New Zealand. Read `README.md` for the architecture, local setup, and command reference before changing code.

## Orient before editing

1. Run `git status --short` and preserve unrelated work; this repository may already contain in-progress recipe changes.
2. Locate the task by responsibility:
   - `planner.mjs`: pure planning, suggestion, validation, and shopping-list logic.
   - `cloud-store.mjs`: Firebase record encoding, decoding, revisions, and writes.
   - `app.js`: browser state, rendering, event handling, and Firebase integration.
   - `styles.css` and `index.html`: presentation and static entry point.
   - `recipes/<group>/*.md` and `data/ingredients.json`: authored recipe/catalogue sources.
   - `scripts/build-data.py`: validation and generation of `data/recipes.json`.
   - `firestore.rules`: household access and persisted-record contract.
3. Read the nearest tests before changing behaviour. The verification matrix in `README.md` maps changes to commands.

The app has no package-manager install or bundling step for normal development. It uses browser ES modules, generated static JSON, and Firebase modules loaded from Google's CDN.

## Source and generated-file boundaries

- Treat recipe Markdown and `data/ingredients.json` as source. Never hand-edit `data/recipes.json`; regenerate it with `python3 scripts/build-data.py` and commit it with its source changes.
- Recipe cards contain a `recipe-data` JSON block with a stable ID and quantified ingredients. Keep that metadata consistent with the readable ingredient list. Ingredient keys and editable pack-size estimates are defined in `data/ingredients.json`.
- Treat the `?v=` values in `index.html` as generated cache keys. After changing `app.js`, `planner.mjs`, `cloud-store.mjs`, `firebase-config.json`, or `styles.css`, run `./scripts/bust-cache.sh` and include the resulting `index.html` change. The pre-commit hook covers only a subset of these files, so do not rely on it alone.
- Dated exports in `weeks/` are planning history and backups, not app-published data. Do not silently revise historical recipe snapshots.

## Weekly planning

Before proposing or saving a new week, read `preferences.md`, `feedback.md`, and the latest two plans in `weeks/`. Choose dinners only from existing recipe cards in `recipes/`; weekly planning is selection-only. Adding or improving recipes is a separate, explicitly requested activity and must use `.agents/skills/recipe-development/SKILL.md`.

For each new week:

1. Use the requested number of fresh-cooked dinners for two people; default to four.
2. Keep active cooking time to 30 minutes or less for every dinner.
3. Include a deliberate mixture of Asian and Western meals. Thai and Chinese should appear regularly without making every meal Asian.
4. Do not use raw salad or raw onion. Cooked vegetables and cooked onion are fine.
5. Avoid recently used dinners unless asked. Consolidate the shopping list around standard NZ supermarket pack sizes, sharing fresh protein packs and perishable produce where practical.
6. Record quantities, the ingredient-reuse map, recipes or recipe links, and a consolidated shopping list in a dated export under `weeks/`.
7. Leave the feedback section ready for the household to complete after cooking.

When information is missing, use stored preferences and feedback first. Ask only questions that materially affect the plan.

## Firebase contract

Firestore record IDs, payload shapes, revisions, and household authorization form one shared contract across `app.js`, `cloud-store.mjs`, and `firestore.rules`. When a feature changes that contract, update the rules and `tests/firestore.integration.mjs` in the same change. Do not consider it complete until the `Deploy Firestore rules` workflow succeeds after the push to `main`.

## Change delivery

Run the focused checks for the files changed, then review `git diff` and `git status --short`. Commit only request-related files and push the commit to the configured remote by default unless the user explicitly says otherwise. Never absorb unrelated work into generated data or the commit.
