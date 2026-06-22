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
| **Live ACS data fetch** | ❌ **blocked — `api.census.gov` now requires an API key** |
| **HUD ZIP→CBSA crosswalk fetch** | ❌ **blocked — `huduser.gov` returns HTTP 202 / empty** |
| National enriched dataset + coverage | ⏸ blocked on the two fetches above |

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

## Blockers (need credentials / access — environment, not code)

1. **`api.census.gov` requires an API key.** Data calls (not the metadata
   endpoint) return HTTP 200 + an HTML "Missing Key" page. Set a free key via
   `CENSUS_API_KEY` (https://api.census.gov/data/key_signup.html). Once set, the
   ACS demographic fetch + propensity scoring path is ready to run.
2. **`huduser.gov` ZIP→CBSA crosswalk download returns HTTP 202 with an empty
   body** (consistently, across retries). `www2.census.gov` (the OMB delineation
   file) works fine through the same allowlist, so this is HUD-specific
   (bot-protection / async edge). The HUD public API path
   (`/hudapi/public/usps`) returns HTTP 401 — i.e. it needs a HUD API token.
   Options: provide a HUD API token, host the crosswalk file somewhere reachable
   (`ZMP_HUD_URL`), or drop a local copy into `data/cache/hud_zip_cbsa.xlsx`.

## To finish the run once unblocked

```
export CENSUS_API_KEY=...                      # unblocks ACS
# and one of: HUD token / ZMP_HUD_URL / cached data/cache/hud_zip_cbsa.xlsx
python -m zip_msa_personas official \
    --appa <NPOS xlsx> --year 2022 --outdir out_official
```

This will write `enriched_national_official.csv`, `persona_distributions.csv`,
and the `coverage/` report, and print the **survey-anchored vs demographic-model
split** (`provenance` ∈ {`survey_anchored`, `demographic_model`}): ZIPs the NPOS
survey reached are empirical-Bayes blended with the demographic prior; the rest
get the demographics-only propensity estimate.
