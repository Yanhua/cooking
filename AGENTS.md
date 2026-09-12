# Cooking project instructions

This project is a reusable dinner-planning library for two people in New Zealand.

Before proposing or saving a new week, read `preferences.md`, `feedback.md`, and the latest two plans in `weeks/`. Choose dinners only from existing recipe cards in `recipes/`; do not generate recipes during weekly planning. Avoid repeating a recently used dinner unless asked. Create or expand the library as a separate, explicitly requested activity.

For each new week:

1. Use the requested number of fresh-cooked dinners for two people. Default to four when no count is specified; the count is configurable per week.
2. Keep active cooking time to 30 minutes or less for every dinner.
3. Include a deliberate mixture of Asian and Western meals; Thai and Chinese should appear regularly, without making every meal Asian.
4. Do not use raw salad or raw onion. Cooked vegetables and cooked onion are fine.
5. Consolidate the shopping list around standard NZ supermarket pack sizes. Split fresh protein packs and perishable produce across multiple dinners where practical.
6. Record quantities, the plan's ingredient-reuse map, recipes or recipe links, and a consolidated shopping list in a dated export under `weeks/`; these exports are planning history and backups, not app-published data.
7. Leave the feedback section ready for the household to complete after cooking. Add or improve recipes separately from weekly selection, preserving saved recipe snapshots.

When information is missing, first use the stored preferences and previous feedback. Ask only questions that materially affect the plan.

## Recipe development

For explicitly requested recipe additions or improvements, use `.agents/skills/recipe-development/SKILL.md`. This project skill requires verified recipe sources, documented adaptations, and compatible recipe cards. Weekly planning remains selection-only.

## App data

Recipe cards contain `recipe-data` JSON metadata with stable IDs and quantified ingredients. Maintain the readable ingredient list alongside the metadata. Ingredient units and editable pack-size estimates are in `data/ingredients.json`. Run `python3 scripts/build-data.py` after content changes and `./scripts/bust-cache.sh` after app changes. Weekly JSON exports belong in `weeks/` for planning history and backups; the builder does not publish them into the app. Never silently alter historical recipe snapshots.

## Firebase rules deployment

Treat Firestore record IDs, payload shapes, and household authorization as a shared app contract. When a feature changes any of these, update `firestore.rules` and its integration tests in the same change. The `Deploy Firestore rules` GitHub Action deploys the version-controlled rules automatically on pushes to `main` when `firestore.rules`, `firebase.json`, `app.js`, or `cloud-store.mjs` changes. Do not consider a rules-affecting feature complete until that workflow succeeds.
