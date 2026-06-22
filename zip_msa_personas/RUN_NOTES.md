# Official run — validation notes (2026-06-22)

First attempt at the full-resolution, MSA-only official pipeline on the real APPA
NPOS workbook:

```
python -m zip_msa_personas official --appa <NPOS xlsx> --year 2022 --outdir out_official
```

This is the first time the live Census ACS variable codes have been validated
against the real API. Findings below. Proprietary NPOS data and any derived
per-ZIP outputs are git-ignored — only these notes are committed.

## TL;DR

| Step | Status |
|---|---|
| Dependencies install | ✅ |
| NPOS workbook ingest (offline) | ✅ 6,071 ZIPs, 8,104 (zip,segment) cells |
| ACS variable-code validation (live metadata) | ✅ all codes valid; **1 rollup bug found + fixed** |
| ACS error handling for missing key | ✅ hardened (was a cryptic decode error) |
| **Live ACS data fetch** | ✅ **succeeded with a Census API key (passed via `--census-key`)** |
| **ACS codes validated against live data** | ✅ all 5 tables returned valid numeric data; marital de-dup confirmed |
| HUD ZIP→CBSA crosswalk fetch | ⚠️ bot-blocked (`huduser.gov` HTTP 202) → ran **demographics-only**, MSA labels blank (expected) |
| National enriched dataset + per-ZIP distributions + coverage | ✅ **33,774 ZIPs scored** |

## Run results (2026-06-22, ACS 2022, demographics-only)

Live ACS demographics → propensity scoring → empirical-Bayes blend with the NPOS
survey. **33,774 ZIPs** scored; per-ZIP persona distributions sum to 1.0.

**Survey-anchored vs demographic-model split:**

| provenance | ZIPs | % | mean confidence |
|---|---|---|---|
| `survey_anchored` (NPOS reached the ZIP) | 6,018 | 17.8% | 0.297 |
| `demographic_model` (ACS-only estimate) | 27,756 | 82.2% | 0.206 |

(6,018 of the 6,071 NPOS ZIPs matched a 2022 ACS ZCTA; the ~53 unmatched are the
usual ZIP-vs-ZCTA gap. The demographic model covers the whole country, so there
is no disclosed-extrapolation tail.) Metro/non-metro is `unknown` for all ZIPs
because the HUD ZIP→MSA crosswalk was unreachable — re-run with HUD access to
populate `msa_cbsa` / `msa_title` / `in_metro`.

Dominant-persona mix nationally: Comfort Companions 57.0%, Well-being Warriors
13.4%, Adventure Seekers 12.5%, Passionate Parents 7.2%, Security Seekers 5.4%,
Ambitious Go-Getters 3.0%, Prudent Pragmatists 1.6%.

Outputs (git-ignored — derived from proprietary NPOS): `out_official/`
`enriched_national_official.csv`, `persona_distributions.csv`, `coverage/`.

### ACS codes validated against live data
The full run pulled all four propensity tables (B01001 age, B19001 income,
B02001+B03003 race, B12001 marital) plus the feature set across ~33.8k ZCTAs and
produced sensible distributions. Spot-check on ZCTA 10001 (Manhattan):
pop 27,004, median HH income $106,509, median age 35.7; marital "Now married:"
total 7,018 includes 537 separated → de-duped `married` = 6,481, with separated
counted only in `formerly_married`. The de-dup fix below behaves correctly on
live data.

## What was validated

### ACS variable codes — validated against live metadata
`https://api.census.gov/data/2022/acs/acs5/variables.json` is reachable
**without** a key, so every variable code the pipeline pulls was checked against
the official label:

- **`data_sources.ACS_VARIABLES`** (similarity features): all 8 correct
  (B01003 pop, B19013 median HH income, B01002 median age, B25077 home value,
  B15003_022 bachelor's, B23025_005 unemployed, B25003_003 renter, B11001 HH).
- **`acs.py` B01001** Sex-by-Age (19 male/female band pairs): all correct.
- **`acs.py` B19001** Household Income (16 brackets): all correct.
- **Race/ethnicity** B02001_002/003/005 + B03003_003: all correct.
- **`acs.py` B12001** Sex by Marital Status: codes valid, **but a
  double-counting bug in the rollup** — see below.

### Bug fixed: separated counted twice in the marital rollup
The ACS `B12001` "Now married:" total (`_004E`/`_013E`) **nests** "Married,
spouse absent: Separated" (`_007E`/`_016E`) inside it. The pipeline mapped
`now_married → married` while *also* mapping `separated → formerly_married`
(per the persona fingerprints, which treat separated as formerly-married). Net
effect: separated residents were counted in **both** the `married` and
`formerly_married` categories, inflating the denominator and distorting every
ZIP's marital fractions.

**Fix** (`acs.py`): after summing, subtract the separated count back out of
`now_married` so `married` / `formerly_married` are disjoint. Documented inline.

### Error handling hardened
A keyless (or invalid-key) ACS request returns **HTTP 200 with an HTML "Missing
Key" page**, not JSON — so `raise_for_status()` passes and a bare `.json()` blew
up with a cryptic `JSONDecodeError`. Both `acs.fetch_acs_demographics` and
`data_sources.load_acs_zcta_features` now detect the non-JSON response and raise
a clear `DataUnavailable` pointing at `CENSUS_API_KEY`. (`load_acs_zcta_features`
also now actually *sends* the key — previously it never did, so it would have
failed even with a key configured.)

### NPOS ingest works offline
The attached workbook parses to **6,071 ZIPs / 8,104 (zip, segment) cells**
across the 7 APPA segments — matching the ROADMAP's stated data reality. The 7
segment names line up exactly with `data/persona_fingerprints.json`.

## Status of the two access issues

1. **`api.census.gov` API key — RESOLVED.** Data calls require a key (keyless
   calls return HTTP 200 + an HTML "Missing Key" page). Added a `--census-key`
   flag to the `official` command so the key is passed at runtime (it feeds the
   existing key-aware fetch path); `CENSUS_API_KEY` env still works too. The live
   ACS fetch then succeeded.
2. **`huduser.gov` ZIP→CBSA crosswalk — still bot-blocked (HTTP 202, empty).**
   `www2.census.gov` (OMB delineation) works through the same allowlist, so this
   is HUD-specific; the HUD API path returns 401 (needs a token). The `official`
   command now degrades gracefully: if the crosswalk is unreachable it runs
   **demographics-only** with blank MSA labels (per the run above). To populate
   MSA geography, supply a HUD API token, host the crosswalk (`ZMP_HUD_URL`), or
   drop a local copy at `data/cache/hud_zip_cbsa.xlsx`, then re-run.

## Code changes made this run (beyond the validation fixes above)

- `cli.py`: `--census-key` flag on `official`; ACS failure is fatal, HUD failure
  degrades to demographics-only.
- `pipeline.run_demographic_blend`: accepts `ref=None` → blank MSA columns.
- `batch.coverage_report`: recognizes the blend provenance tiers
  (`survey_anchored` / `demographic_model`) instead of dropping them (it
  previously only knew the impute tiers, which would have emptied the split).
