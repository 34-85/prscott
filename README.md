# PSMF Tracker

A self-contained, browser-only app for running a Protein-Sparing Modified Fast.
Open `index.html` directly in a browser or serve the folder with any static
HTTP server — there is no build step and no backend. All data stays on your
device via `localStorage`.

## Features

- **Dashboard** — current weight, total lost, % to goal, 14-day loss rate,
  projected goal date, and today's macros at a glance.
- **Today** — search a built-in food database, log servings, and watch
  protein / fat / carb / calorie progress vs your targets in real time. Also
  log the morning weigh-in for the day.
- **Weight** — daily weigh-in log with a chart, 7/14/30-day rolling loss
  rates, and per-entry deltas from your start weight.
- **Calculator** — PSMF macro/calorie calculator using lean body mass.
  Auto-fills protein and fat recommendations from body-fat tiers (Lyle
  McDonald protocol). Shows BMR, TDEE, and projected weekly loss.
- **Profile** — sex / age / height / weight / body-fat / activity, plus
  macro targets and start/goal weights that drive everything else.
- **Learn** — what PSMF is, food do/don't lists, refeed guidance,
  electrolyte targets, contraindications, and a soft re-feed plan.

## Data

- Stored in `localStorage` under the single key `psmf-tracker-v1`.
- Use **Export** in the footer to download a JSON backup, and **Import** to
  restore it. **Reset all** wipes everything from this browser.

## Disclaimers

This is information, not medical advice. PSMF is an aggressive protocol.
Talk to a clinician before starting if you have any underlying conditions,
take medication, or are unsure whether it's safe for you.
