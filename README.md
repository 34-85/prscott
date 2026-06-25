# PSMF Tracker

A mobile-first web app for **food, weight, and PSMF-style diet tracking** — built as a
calm performance dashboard rather than a consumer calorie counter.

It does two jobs:

1. **Tracker** — log weight and food, estimate calories/macros from natural language, and
   measure PSMF compliance in real time.
2. **Coach** — forecast weight loss, detect stalls, separate fat loss from water
   fluctuation, and give precise, shame-free behavioral guidance.

Design language: **Bloomberg terminal × Apple Health × executive dashboard** — quiet,
high-contrast, fast data entry, no gamified noise.

> ⚠️ This app estimates nutrition and weight trends. It is not medical advice.
> Very-low-calorie or PSMF-style diets should be used carefully, especially with medical
> conditions or medications.

---

## Install

Requires Node 18+.

```bash
npm install
```

## Run

```bash
npm run dev       # start the dev server (Vite) → http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # preview the production build
npm run lint      # type-check only (tsc --noEmit)
```

On first launch the app seeds **two weeks of realistic demo data** (strong PSMF days, a
mediocre day, a planned refeed, and a water-fluctuation spike) so every screen is immediately
meaningful. Erase it or reload it any time from **Settings → Data**. All state persists to
`localStorage`; there is no backend and no external API.

---

## Architecture overview

```
src/
  app/
    App.tsx            # tab shell (Today / History / Foods / Settings) + bottom nav
    store.tsx          # React context: state + actions, localStorage persistence
  components/
    Dashboard.tsx      # "Today" view — composes the panels below
    WeightEntry.tsx    # morning weigh-in entry
    MealLogger.tsx     # natural-language meal entry with live macro preview
    RunningTotals.tsx  # logged totals + remaining daily allowances
    ComplianceScore.tsx# PSMF 0–10 gauge + component breakdown
    ForecastCard.tsx   # required vs observed pace, projected goal date
    CoachInsights.tsx  # coaching cards
    History.tsx        # weight / score / calorie / protein charts + weekly summaries
    Foods.tsx          # food library browser + personal-food editor
    Settings.tsx       # editable targets, plan, meat-weight mode, data controls
    Badge.tsx          # protein-efficiency badge pill
  lib/
    types.ts           # domain types
    foodDatabase.ts    # personal library (branded) + generic USDA-style foods
    parser.ts          # tokenizes raw text → quantity / unit / modifiers / food
    macroEstimator.ts  # matches parsed food → DB → macro estimate + confidence
    compliance.ts      # PSMF 0–10 scoring
    forecast.ts        # rolling average + regression pace + goal projection
    coach.ts           # insight generation (stalls, water vs fat, pacing)
    storage.ts         # persistence + pure state mutators + recompute
    seed.ts            # demo data generator
    dates.ts           # date-key helpers
```

**Data flow.** Every mutation goes through `store.tsx`, which calls a pure mutator in
`storage.ts`. Mutators recompute a day's cached totals and compliance via `recomputeLog`, then
the new `AppState` is persisted to `localStorage`. Derived views (forecast, coach, charts) are
computed on render from the logs — they are never stored, so changing a setting instantly
re-scores all history.

### Tech stack

React 18 · TypeScript · Tailwind CSS · Vite · localStorage. No backend, no paid APIs. Charts
are hand-rolled SVG (no chart library) to keep the bundle small.

---

## Logging modes

The **Today** tab offers two ways to log, switchable with a toggle (your choice is
remembered):

### Chat mode (preferred)

A conversational surface where you type naturally and the app classifies each line via
`classifier.ts` into one of four intents, then routes it:

| You type | Classified as | Action |
|----------|---------------|--------|
| `214.6 this morning` | **weight** | sets morning weigh-in (trailing words become a note) |
| `Slate shake` | **meal** | parses + logs the meal |
| `Correction: 10 oz chicken not 8` | **correction** | re-estimates and replaces the matching meal |
| `actually 213.2` | **correction** | overwrites the morning weight |
| `Delete lunch` | **delete** | removes the referenced meal |
| `note: slept poorly, high sodium` | **note** | jots a free-form day note |

Classification heuristics: a `delete`/`remove`/`undo` trigger → delete; a leading body-weight
number (50–600, no food match) → weight; a correction trigger (`correction`, `actually`,
`fix`, `i meant`, …) strips the trigger, conversational filler, and any trailing “… not X”
clause, then sub-classifies the remainder as weight or meal; an explicit `note:` prefix or
feeling/sleep/sodium keywords → note; a recognized food (or a unit/quantity) → meal. The
composer shows a live **“Reads as …”** chip with the detected intent and confidence before you
send.

**Meal editing & deletion.** Corrections and deletes resolve a natural-language meal reference
via `mealRef.ts`: meal-time words (`breakfast`/`lunch`/`dinner` → time-of-day buckets),
position (`last`/`first`), or a food name (`the chicken`). A correction re-estimates and
replaces the best-matching meal; `Delete lunch` removes it. The transcript is rendered directly
from the day's data, so every edit stays consistent with the rest of the dashboard.

### Structured mode

The classic UI: a dedicated morning-weight field, a “+ Add Meal” sheet with a live macro
preview and quick-add chips, and a meal list where each entry expands to **Edit** (reopens the
sheet in edit mode, preserving id/timestamp) or **Delete**. Identical data, just form-driven.

---

## Meal parsing & estimation

You log meals in natural language, e.g. `10 oz sirloin, asparagus, 1 tbsp butter`.

1. **`parser.ts`** splits the line on separators (`,`, `and`, `with`, `+`) and extracts a
   leading quantity (numbers, fractions, number-words), a unit (`oz`, `cup`, `scoop`, `tbsp`,
   `bottle`, `serving`, …), and preparation modifiers (`grilled`, `lean`, `cooked`, …).
2. **`macroEstimator.ts`** matches each food phrase against the database, preferring the
   **personal/branded library over generic entries**, then scales the entry's per-unit macros
   by the resolved amount and assigns a **confidence** (high / medium / low).

Key rules implemented:

- **Meat weights are cooked** by default. Meats are stored per-ounce, so `8 oz grilled
  chicken breast` → 376 kcal / 70 P / 8 F (high confidence).
- **Branded defaults** — `Slate` → 1 bottle (180/42/2/1); `cottage cheese` → 1 cup (2
  servings); `whole tub greek yogurt` → 5 servings.
- **Cooking fats are additive** — `8 oz chicken + 1 tbsp olive oil` → 376 + 120 kcal.
- **Unknown foods still estimate** with a low-confidence placeholder so totals keep moving.

## Restaurant estimation mode

Restaurant and unknown meals carry large portions and uncounted cooking fats, so a point
estimate would lie. `restaurant.ts` instead returns a **macro range**, a **confidence score**,
and the **calories likely hidden** in oils/butter/sauces. It reads five signals from the text:

- **Protein source** → anchors the estimate with a typical restaurant portion (e.g. chicken
  6–9 oz, steak 6–10 oz) at slightly fattier per-oz macros.
- **Portion size** → words like *large*/*half* scale the portion (×1.3 / ×0.7).
- **Visible fats** → butter, oil/fried, cheese, avocado, bacon, nuts.
- **Sauces** → creamy/alfredo/aioli, gravy, sweet glaze, pesto, dressing — the biggest source
  of hidden calories.
- **Starch presence** → rice, pasta, fries, potato, bread, burrito, beans, pizza.

Every restaurant meal also gets a **cooking-fat tax** (~50–150 kcal) that always counts toward
hidden calories. Confidence caps at **medium** (these meals are inherently uncertain) and is
*low* when the protein can't be identified.

It's reached three ways: a **toggle** in the Add Meal sheet; an **auto-suggestion** when the
canonical DB can't match the text (or a restaurant keyword/brand appears); and **automatically
in chat mode** for the same triggers. The logged meal stores the full range + hidden calories
on `meal.restaurant` and contributes the **range midpoint** to your daily totals (shown with a
`~` and a `RESTAURANT ~EST` tag everywhere it appears).

Example — `chicken alfredo pasta from olive garden` →
690–1380 kcal · 60–94 P · 44–94 C · 29–73 F, ~300 kcal hidden, medium confidence
(signals: chicken ~6–9 oz, cooking oil/butter, creamy sauce, pasta).

### Protein efficiency badges

`protein g / 100 kcal`, shown on every food and meal card:

| Badge | Efficiency |
|-------|-----------|
| Elite PSMF | > 18 |
| Strong | 12–18 |
| Acceptable | 8–12 |
| Poor for cut | < 8 |

---

## Compliance scoring (0–10)

`compliance.ts` scores each logged day:

| Component | Points | Logic |
|-----------|--------|-------|
| Protein | 0–3 | full credit at/above the floor (over-max protein is fine on PSMF) |
| Carbs | 0–2 | full credit under the cap; partial up to 1.5× |
| Fat | 0–2 | full credit under the cap; partial up to 1.5× |
| Calories | 0–2 | full credit inside the min–max window; partial just outside |
| Logging | 0–1 | rewards logging meals + a morning weigh-in |

Status labels: **Excellent** (9–10) · **Strong** (8–8.9) · **Acceptable** (7–7.9) ·
**Marginal** (5–6.9) · **Off Plan** (< 5).

---

## Forecasting

`forecast.ts` works from the **trend, not single readings**:

- **7-day rolling average** of morning weights smooths daily water noise.
- **Observed pace** is the least-squares regression slope over all weigh-ins (lb/day → lb/week).
- **Required pace** = `goalLoss / targetWeeks`; the implied deficit uses **3500 kcal ≈ 1 lb fat**.
- **Projected goal date** extrapolates the remaining loss at the observed pace.
- **Status** compares observed vs required pace with a ±10% tolerance band → *Ahead / On /
  Behind schedule*.

Default plan: lose 20 lb in 11 weeks ≈ **1.82 lb/week ≈ 0.26 lb/day ≈ ~900 kcal/day deficit**
(all editable in Settings).

---

## Coaching engine

`coach.ts` generates calm, analytical insights and deliberately **does not overreact to a
single weigh-in**:

- **Water vs fat** — when the scale jumps but recent compliance is high, it explains the rise
  as water / sodium / glycogen / inflammation, not fat gain.
- **Plateau detection** — if the 7-day average is flat for 10+ days despite compliance > 8, it
  flags a genuine stall and suggests a small calorie trim, light activity, sodium consistency,
  sleep, or a planned refeed.
- **Pacing** — surfaces ahead / on / behind status with concrete, non-drastic next steps.
- **Protein shortfall** — flags multi-day protein under the floor and how to close the gap.

Tone is always precise and shame-free; it never scolds.
