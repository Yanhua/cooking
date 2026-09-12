# Dinner planning

A recipe-library-first dinner planner for two people in New Zealand. Build the library separately, then select existing recipes for each week. Four dinners is the default; each week can have any positive whole-number count. Every library dinner has at most 30 minutes of active cooking; total elapsed time may be longer.

## Planning in the app

1. Choose **Plan a week**, a date and the number of dinners.
2. Search or filter the recipe library and add dinners. **Suggest remaining dinners** keeps your selections and fills open slots using existing recipes, preferring cuisine variety and avoiding the latest two earlier weeks. Suggestions never generate recipes.
3. Review ingredient reuse and shopping totals. Pack sizes are editable estimates, not live supermarket listings. Pantry items are a check before buying. Reducing the count keeps your selections until you remove the extras.
4. Unlock with the shared household password and save the plan. Drafts, saved weeks, feedback, tried statuses, recipe comments and favourites sync through Firebase. Export JSON for a durable copy and Markdown for a readable plan. Plans are private household data and are not published from the repository.
5. Existing dates cannot be overwritten from the picker.

A recipe's “Not yet cooked” status does not claim that it has been tested. Use **Mark as tried** on a library recipe after cooking; this status is saved to the household and included in new plan snapshots. Record household feedback after cooking and update the repository recipe status for a shared record.

Open any current recipe to save a household comment and mark it as a favourite. These preferences are stored separately from saved recipe snapshots, so they follow the recipe across plans and library updates.

## Library maintenance

Ask separately to expand the recipe library. Cards live in `recipes/` and include a `recipe-data` JSON comment: stable ID, cuisine, protein, servings, active minutes, equipment, cooking status and ingredient amounts. Keep this metadata and the readable recipe in agreement. Ingredient keys refer to `data/ingredients.json`, which defines canonical units and default pack sizes. Rice amounts are dry weights; chickpea amounts are drained weights (240 g per estimated 400 g can). Garlic uses an estimated 10 cloves per bulb.

The library starts with 24 recipes. The previous Spam fried rice card has been standardised to two servings. Saved plan JSON contains full recipe snapshots; later library changes do not change an already saved plan's recipes or shopping list.

The frontend remains on GitHub Pages. Existing browser saves can be imported after unlocking.

## Run locally

```sh
python3 scripts/build-data.py
python3 -m http.server 8000
```

Open http://localhost:8000. The app uses static JSON and works without GitHub API access. Opening `index.html` directly as a file is not supported.

## Verify and publish

```sh
node --test tests/planner.test.mjs tests/cloud-store.test.mjs
python3 tests/build-data.test.py
python3 scripts/build-data.py
./scripts/bust-cache.sh
```

Publish the repository root with GitHub Pages. Run the builder after changing recipe cards. The generated `data/recipes.json` must be committed. Enable the cache hook with `git config core.hooksPath .githooks`; the included GitHub Action also updates asset cache keys.

- `weeks/`: optional dated plan exports kept as household records and backups; they are not loaded into the app.
- `feedback.md`: shared household feedback used for future planning.

Household feedback is included in exports. Copy relevant notes into `feedback.md` when planning future weeks, and update recipe cards separately for lasting improvements.
