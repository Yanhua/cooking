# Dinner planning

This folder keeps weekly dinner plans, tested recipes, shopping lists, and cooking feedback in one place.

To start a new week, ask: “Plan next week's dinners using this cooking project.” The agent should follow `AGENTS.md`, read the preference and feedback files, then add a dated plan and shopping list.

## Folders

- `recipes/` — reusable recipe cards, organised by cuisine.
- `weeks/` — dated weekly plans, including ingredient reuse and post-cooking notes.
- `shopping-lists/` — standalone shopping lists for use at the supermarket.

## Keeping it useful

After a meal, add a short note to `feedback.md` or the relevant week: rating, substitutions, portion size, and whether to repeat it. Those notes are the source of future improvements.

## Viewing on a phone

`index.html` is a dependency-free, mobile-first viewer for the recipes and weekly plans. It can be published directly with GitHub Pages: in the repository's **Settings → Pages**, choose **Deploy from a branch**, then select the branch and the repository root (`/`). The viewer discovers and renders every Markdown card under `recipes/` from the repository, so new cards need no website code changes.
