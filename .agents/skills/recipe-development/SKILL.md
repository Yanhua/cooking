---
name: recipe-development
description: Research, adapt, and validate source-grounded dinner recipes for this cooking project's library when asked to add or improve recipes. Does not generate recipes during weekly meal planning.
---

# Recipe development

Use this workflow for explicitly requested library additions or improvements. Weekly planning continues to select existing cards.

## Read project context

Work from the cooking repository root. Read `AGENTS.md`, `preferences.md`, `feedback.md`, relevant existing cards in `recipes/`, and `data/ingredients.json`. Use stored preferences and cooking feedback before asking questions. Check for duplicates and preserve stable IDs when improving a card.

## Research before drafting

- Browse and read the actual source recipe, including quantities and method. Prefer accessible cookbook excerpts published by authors or publishers, cookbook authors' own recipes, and reputable specialists with demonstrated knowledge of the cuisine. Assess recipe-specific clarity and testing evidence rather than search ranking or popularity.
- Choose one primary recipe as the foundation. Consult additional sources when needed to resolve technique, substitutions, or regional variations; explain combinations instead of silently merging incompatible versions.
- A search snippet, book listing, review, or remembered recipe does not establish a book's recipe contents. If the recipe cannot be accessed, find an accessible authoritative alternative or state the gap. Never invent citations, page numbers, quantities, or testing claims.
- Record author, recipe title, direct URL, access date, and cookbook title/edition/page only where verified. Distinguish website recipes from verified cookbook excerpts.
- Write concise instructions in original wording with attribution, respecting source quotation limits. Do not copy introductions or long passages.

## Adapt deliberately

- Preserve defining ingredients, techniques, and flavour balance. Identify the regional or author version where supported; do not claim a single universal authentic version.
- Explain material departures, including substitutions, sauce changes, added vegetables, and shortcuts. Label substantial departures as adaptations or inspired dishes. Prefer a better-fitting source recipe if meeting constraints would erase the dish's identity.
- Follow current household preferences: two servings, at most 30 minutes of active work, cooked vegetables, no raw salad or raw onion, and available equipment. Record realistic total elapsed time separately, including unattended cooking and marinating. Include preparation and sides in the active estimate.
- Use practical NZ ingredients and metric quantities. Preserve essential specialty ingredients where needed and explain substitution tradeoffs. Catalog pack sizes are estimates; verify current availability before making specific supermarket claims.
- Scale thoughtfully: check salt, sauces, liquid, pan capacity, and cooking cues rather than assuming all quantities and times scale linearly. Quantify sides, garnishes, and cooking liquids. Distinguish dry, drained, raw, and cooked weights.
- Mark additions `Not yet cooked`. Source credibility and desk review do not establish that the household adaptation has been tested or tastes good. Update status and improve recipes using actual cooking feedback.

## Save compatible recipe cards

Follow existing cards in `recipes/asian/` or `recipes/western/`. Keep readable ingredients and the `recipe-data` JSON comment in agreement. Existing fields are `id`, `cuisine`, `protein`, `servings`, `activeMinutes`, `equipment`, `status`, `ingredients` (objects with `key` and `amount`), and `notes`.

Ingredient keys and amounts must use canonical units in `data/ingredients.json`. Add missing ingredients only when necessary, following the existing schema and identifying pack assumptions as estimates. Do not silently change shared units or introduce an app schema change to store provenance.

Include readable active and total times. Put `## Source` and `## Adaptations` before `## Method`, with bibliographic details and concrete changes. The builder extracts every numbered line after `## Method` as a cooking step, so reserve that region's numbered lists for cooking instructions. Provenance lives in the Markdown card; do not assume the app displays it.

## Validate and report

Review missing ingredients, unused quantities, sequence, feasible timing, doneness cues, and agreement between readable ingredients and metadata. Verify that defining substitutions are disclosed and sources support the claimed foundation.

Run `python3 scripts/build-data.py` after recipe or ingredient changes. Inspect the resulting diff for intended card/data updates, preserving historical weekly recipe snapshots and unrelated changes. The builder checks only part of the contract; manually review methods, timing, and sources. Run relevant additional tests if changing builder or app behavior, and `./scripts/bust-cache.sh` after app changes.

Report saved cards, primary sources, significant adaptations, and validation results. Identify unresolved source limitations and distinguish household taste testing from technical validation.
