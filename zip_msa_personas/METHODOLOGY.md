# Methodology & Confidence

How the geo-persona engine turns APPA's National Pet Owners Survey (NPOS)
segmentation into a national, ZIP-level intelligence product — and, just as
importantly, where each number is trustworthy and where it is directional.

This document is written to be read by a buyer, a partner, or a diligence
reviewer. It is deliberately honest about what the data can and cannot support.

---

## 1. What we are estimating

APPA's NPOS assigns every surveyed pet-owning household to one of **seven
proprietary personas** (the segmentation APPA owns outright):

> Ambitious Go-Getters · Passionate Parents · Well-being Warriors ·
> Security Seekers · Adventure Seekers · Comfort Companions · Prudent Pragmatists

The product answers, for **any U.S. geography** (ZIP, metro/MSA, Nielsen DMA,
Census region, nation): *what is the pet-owner persona mix here, and how
confident are we?* From that substrate we build the application layers —
vet-siting, brand/retailer market-fit, opportunity scoring, lookalike
expansion.

The honest framing we sell on: **the persona mix is real and well-measured at
the national / regional / metro altitude; it is survey-anchored and real at the
ZIP level wherever the survey reached; and it is a directional model estimate at
the ZIP level everywhere else.** Use each layer at the altitude its evidence
supports.

---

## 2. Data sources

| Source | Role | License posture |
|---|---|---|
| **APPA NPOS** (ZIP × segment, survey-weighted) | The ground-truth persona signal | First-party — APPA owns it; no redistribution constraints |
| **Census ACS** 5-year (ZCTA demographics) | Demographic features + the propensity prior | Public domain |
| **Census ZCTA→county relationship + OMB CBSA delineation** | ZIP→MSA crosswalk | Public domain |
| **HUD ZIP→CBSA crosswalk** | Alternate ZIP→MSA path (fallback) | Public domain (bot-gated in practice) |
| **Nielsen ZIP→DMA** (optional) | DMA geography | **Licensed** — supplied by the client; assignments tagged `nielsen_dma` and gated by `rights.py` |

The commercial advantage: the persona signal and every geography we *ship* are
first-party or public-domain, so the deliverable carries **no licensing
handcuffs**. The one licensed input (DMA) is isolated and rights-tagged so it
never leaks into a sellable file.

### The data reality that shapes everything
The NPOS ZIP × segment matrix is **thin**: ~6,000 ZIPs carry any survey weight,
the median surveyed ZIP has roughly one weighted respondent, and the U.S. has
~33,000 populated ZCTAs. So the engine is, fundamentally, a principled way to
(a) **stabilize** the thin observed ZIPs and (b) **estimate** the ~82% of ZIPs
the survey never reached — while never dressing an estimate up as a measurement.

---

## 3. The pipeline, stage by stage

```
NPOS workbook ──ingest──▶ tidy (zip, persona, weight)
                                │
ACS ZCTA demographics ──▶ propensity prior ──┐
                                             ├─▶ national calibration (raking)
surveyed ZIP lat/lon ──▶ spatial smoothing ──┘        │
                                                      ▼
            empirical-Bayes shrinkage  ◀── survey anchor + model prior
                                                      │
                                                      ▼
                       per-ZIP persona distribution + provenance + confidence
                                                      │
              ┌───────────────┬───────────────┬───────┴────────┐
           coverage        deliverables     query        application layers
                                                      (vetsiting / marketfit /
                                                       opportunity / lookalike)
```

### 3.1 ZIP → MSA crosswalk (`crosswalk.py`, `data_sources.py`)
Deterministic. Policy: **Metropolitan Statistical Areas only**, **dominant
assignment** (each ZIP → the single CBSA holding the largest share of its
land/address overlap). Built from the Census ZCTA→county relationship file
joined to the OMB CBSA delineation; HUD's ZIP→CBSA file is the fallback. ~20,100
ZIPs (≈59%) land in a metro; the rest are micropolitan / non-metro and labeled
as such.

### 3.2 The persona prior — two predictors, honestly baked off (`propensity.py`, `spatial.py`)
For the ZIPs the survey never reached we need a prior. We built **two** and let
the data choose:

- **Demographic-propensity model.** The APPA deck gives each persona an *index*
  per demographic bucket (age, income, race/ethnicity, marital status). An index
  is a likelihood ratio (100 = national average), so we score any ZIP's ACS
  demographics against every persona's fingerprint (a naive-Bayes / log-linear
  combination) to get a persona mix — no survey needed.
- **Spatial smoothing.** Estimate a ZIP's mix from its *k* nearest **surveyed**
  ZIPs (distance-weighted on lat/lon).

**The bake-off result (the central honest finding):** demographics are a *weak*
local predictor of this psychographic segmentation. Head-to-head on held-out
survey data, spatial smoothing won decisively (directional lift ≈ **+0.31** over
chance vs ≈ **+0.02** for demographics); the **blend** of the two wins on
dominant-persona hit-rate. So the production default for modeled ZIPs is
`--model blend`, with `spatial` a close second and `demographic` retained for
comparison. We did *not* bury this — it is why the product is positioned at
altitude rather than sold as precise ZIP-level truth.

### 3.3 National calibration / raking (`propensity.py`)
The raw propensity prior over-weights broad demographic signals (white, Boomer),
producing an **argmax artifact**: ~57% of ZIPs would be labeled "dominant Comfort
Companions" against a true ~17% share. We fix this with **iterative proportional
fitting (raking)**: the model mix is rescaled so its *national average* matches
the survey's known segment sizes. This removes the artifact without touching the
relative geographic signal. (Disable with `--no-calibrate-national` to inspect
the raw model.)

### 3.4 Empirical-Bayes shrinkage of thin ZIPs (`shrinkage.py`)
A single weighted respondent is not a distribution. Each observed ZIP's mix is
pulled toward its **market prior** (its MSA or DMA, national as last resort),
weighted by its effective sample size (`--shrink-alpha`, default 5). Effect on
real data: observed-tier mean confidence drops from an overconfident 0.94 (74%
of ZIPs pinned at 1.0) to an honest ≈0.30. This is the single most important
guard against selling noise as signal.

### 3.5 Confidence calibration (`calibration.py`, `validation.py`)
"Confidence 0.80" should mean "right about 80% of the time." A backtest hides
observed ZIPs, predicts them through the production path, and fits an **isotonic**
map from raw confidence to empirical accuracy, reporting the **held-out** ECE
improvement. Applied on `run`/`national`, `confidence` becomes a true
probability (raw kept in `confidence_raw`; observed ground-truth rows untouched).
On thousands of real observed ZIPs there is enough data to both help and to
*measure* the gain; on the tiny demo it is ~neutral (and we say so).

---

## 4. Provenance — nothing modeled is mistaken for fact

Every output ZIP carries a `provenance` label and a `confidence` score. There
are two provenance vocabularies depending on the path:

**Similarity-imputation path** (`run` / `national`):

| provenance | meaning | confidence |
|---|---|---|
| `observed` | from the survey (ground truth) | high |
| `imputed_similar` | empty ZIP predicted from look-alike observed ZIPs | medium (data-driven) |
| `extrapolated_baseline` | empty ZIP unlike anything observed; baseline | **low — disclosed** |

**Demographic-blend path** (`official`):

| provenance | meaning | confidence |
|---|---|---|
| `survey_anchored` | the NPOS survey reached this ZIP | higher |
| `demographic_model` | ACS-only model estimate | lower |

On the real official run the split is ≈**17.8% survey-anchored** (mean conf 0.30)
/ ≈**82.2% demographic-model** (mean conf 0.21). The "similar enough" cutoff in
the imputation path is **data-driven** — a high percentile of observed-ZIP
distances in feature space, not a hand-picked constant.

Every row is also stamped with `methodology_version`, `data_vintage`,
`model_params`, and `evidence` (the actual look-alike ZIPs or baseline that
produced an estimate) — so a customer's "where did this number come from?"
always has an answer.

---

## 5. Does it actually work? The validation story

We validate where the survey is dense enough to be a fair referee — at the **MSA
and Census-region** level — by asking whether the model reproduces the surveyed
mix (`validation.validate_model_vs_survey`).

**Raw demographic model, MSA-level (before the survey blend), real data:**
- Top-persona agreement: **24.5%**
- Mean absolute share error: **0.046** (4.6 points per persona)
- Per-persona correlations: weak but mostly positive — Prudent Pragmatists
  r=+0.36, Passionate Parents +0.29, Comfort Companions / Security Seekers +0.20;
  Well-being Warriors −0.17.

Read plainly: **the demographics-only prior is a weak positive signal on its
own.** That is exactly why the national calibration and the survey-anchored blend
carry the weight, and why spatial smoothing (not demographics) drives the modeled
ZIPs. This is the finding that keeps the product honest — and it is documented,
not hidden.

What this means for **where to trust the output**:

| Altitude | Trust | Why |
|---|---|---|
| **National / Census region** | High | Calibrated directly to survey segment sizes; lots of survey per cell |
| **MSA / metro** | Good (directional rankings) | Enough survey to validate; over/under-index direction is reliable |
| **DMA** | Good where survey is present | Same logic as MSA, given a licensed crosswalk |
| **Surveyed ZIP** | Real, but shrunk | Ground truth, stabilized for thin sample |
| **Modeled ZIP** | **Directional only** | Spatial/blend estimate; label as low-confidence |

---

## 6. Known limitations (state them before the buyer does)

- **Demographics weakly predict psychographics.** Validated, not assumed. The
  product leans on spatial structure + the survey, not on a demographic
  black-box.
- **Thin-ZIP noise can propagate.** Spatial smoothing can carry a noisy surveyed
  ZIP into small neighboring markets, producing extreme small-market indices
  (e.g. a Kankakee Security Seekers index of 462). This is now guarded by the
  **reliability filter** (`reliability.py`): every "top markets" ranking — vet,
  brand, retailer, and the `query` lookups — measures the real survey support
  behind each market (`survey_zips` = ZIPs an actual survey response reached) and
  requires a minimum (`--min-survey`, default 3) before a market can be trusted
  at the top. The persona *index* is still computed against the full national
  mean; the filter only governs which markets are allowed to rank, and the full
  flagged ranking (every market, with `survey_zips` + `reliable`) is always
  written to the output CSV for transparency. The complementary per-cell
  significance machinery (`indexing.py`, Wilson intervals on effective sample
  size) remains available for confidence-aware index reporting.
- **ZIP-vs-ZCTA gap.** ~7,000 ZIPs aren't in the 2020 ZCTA universe and carry
  blank MSA labels / no ACS features; this is the standard postal-vs-statistical
  geography mismatch, not a pipeline error.
- **Application-layer affinity weights are a starting hypothesis.** The
  persona→service-model (vet) and persona→category/format (brand/retail) weights
  are seeded from the deck's spend/attitude signals. The `derive-affinities`
  path replaces these with **empirical** affinities once respondent-level NPOS
  microdata is available — at which point the application layers become
  data-grounded rather than expert-seeded.

---

## 7. Versioning & lineage

- `methodology_version` (`impute.METHODOLOGY_VERSION`, currently `1.0.0`) stamps
  every row; bump it when the estimation logic changes.
- `data_vintage` (e.g. `NPOS2025;ACS2022;HUD2023Q4`) records the exact inputs.
- `model_params` records the run-time knobs (`k`, `shrink_alpha`, predictor).
- `evidence` records the specific look-alikes / baseline behind each estimate.

Together these make every deliverable **auditable row by row** — the
table-stakes requirement for selling data that includes modeled values.

---

*See [`COMMANDS.md`](./COMMANDS.md) for how to run every stage, and
[`README.md`](./README.md) for the product overview.*
