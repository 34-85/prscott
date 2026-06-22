# Command & Workflow Reference

Every command in the engine, what it's for, and the two-session operating
pattern that produces a real run. Invoke anything as:

```bash
python -m zip_msa_personas <command> [options]
```

`python -m zip_msa_personas <command> -h` prints the live flags for that command.

---

## The two-session operating pattern

The networked stages need `census.gov` (ACS + crosswalk) and a Census API key.
Most managed environments allowlist only specific hosts, so the workflow is split
into two kinds of session:

| Session | Network | Does |
|---|---|---|
| **Build session** (this one) | none required | Write/extend code, run the offline `demo`, run `validate`/`calibrate`/`coverage` on demo data, all tests. Never touches proprietary data on the network. |
| **Census-enabled session** | `census.gov` + `--census-key` | Runs `official` / `bakeoff` / `vetsiting` / `marketfit` / `deliverables` on the **real NPOS workbook**, then commits *code/notes only* and uploads the generated files. |

Proprietary NPOS data and every per-ZIP output derived from it are **git-ignored**
— only code, tests, and notes (`RUN_NOTES.md`) are committed. The polished files
(workbook, maps, one-pagers, scorecards) are delivered out-of-band.

> **Census API key:** pass it at runtime via `--census-key` (or `CENSUS_API_KEY`
> in the shell). Do **not** put it in the environment's env-vars box — that box
> warns against storing secrets, and a keyless ACS call returns an HTML
> "Missing Key" page, not data.

---

## Quick start (offline, no network, no data)

```bash
pip install -r requirements.txt
python -m zip_msa_personas demo --out enriched_demo.csv     # full pipeline on synthetic data
PYTHONPATH=. python3 tests/test_pipeline.py                 # the test suite (51 passing)
```

---

## Command catalog

### Core pipeline

| Command | Network | Purpose |
|---|---|---|
| `demo` | — | End-to-end run on bundled synthetic data. The fastest "see it work." |
| `data` | census | Fetch + cache the real HUD/Census reference data (crosswalk, CBSA meta, ACS features). |
| `ingest-appa` | — | Convert the APPA NPOS *ZIP-by-segment* workbook → tidy `(zip, persona, weight)` CSV. Offline. |
| `run` | census | Real run on a tidy persona file (similarity-imputation path). |
| `national` | census | Score the full ZCTA universe + write the coverage report. |
| `official` | census + key | **The headline real run:** ACS demographics → propensity → spatial/blend → survey anchor. Writes the enriched national dataset + per-ZIP distributions + coverage. |

```bash
# Offline ingest, then the official run in a Census-enabled session:
python -m zip_msa_personas ingest-appa --input "Zip code data by segments.xlsx" --out appa_personas.csv

python -m zip_msa_personas official \
    --appa "Zip code data by segments.xlsx" \
    --year 2022 --census-key $CENSUS_KEY \
    --model blend --outdir out_official
# -> out_official/enriched_national_official.csv
#    out_official/persona_distributions.csv
#    out_official/coverage/
```

Key `official` flags: `--model {blend,spatial,demographic}` (default `blend`;
bake-off winner), `--no-calibrate-national` (inspect the raw model),
`--shrink-alpha` (prior strength, default 5), `--k` (spatial neighbors),
`--zip-dma` (licensed crosswalk for DMA geography), `--data-vintage`.

### Quality & trust

| Command | Network | Purpose |
|---|---|---|
| `bakeoff` | census + key | Head-to-head: demographic vs spatial vs blend predictor on held-out survey data. Proves which prior to use. |
| `validate` | census (or `--demo`) | Cross-validated calibration report: accuracy by confidence band, tier ordering. |
| `calibrate` | census (or `--demo`) | Fit the isotonic calibrator (`calibrator.json`); reports held-out ECE improvement. |
| `coverage` | — | Coverage report (observed vs modeled vs disclosed) from any enriched CSV. |
| `export` | — | Strip non-resellable (licensed) fields → sellable file + rights manifest. |

```bash
python -m zip_msa_personas bakeoff --appa appa.xlsx --census-key $CENSUS_KEY
python -m zip_msa_personas calibrate --demo --out calibrator.json
python -m zip_msa_personas national --demo --calibrator calibrator.json --out enriched.csv
python -m zip_msa_personas export --input enriched.csv --out deliverable.csv
```

### Answering business questions (the "just ask" layer)

| Command | Network | Purpose |
|---|---|---|
| `query` | — | Plain-language lookups on the scored dataset: a ZIP's mix, a market's mix, top markets for a persona, a one-line siting read. |
| `opportunity` | — | Rank ZIPs/MSAs by fit to a client's target personas × addressable size; flags whitespace. |

```bash
python -m zip_msa_personas query --enriched E.csv --distributions D.csv --zip 32779
python -m zip_msa_personas query --enriched E.csv --distributions D.csv \
    --top-persona "Ambitious Go-Getters" --group-col msa_title --n 20
python -m zip_msa_personas opportunity --enriched E.csv \
    --targets-inline '{"Well-being Warriors":1.0,"Ambitious Go-Getters":0.8}' --out opp.csv
```

### Customer applications

All three consume the `official` outputs (`enriched_national_official.csv` +
`persona_distributions.csv`).

| Command | Network | Purpose |
|---|---|---|
| `viability` | census + key (optional) | **The combined one-sheet market view:** persona economic value × HH income × addressable demand × vet-siting model, graded A–D, reliability-filtered. |
| `vetsiting` | census + key (optional) | Per-metro scorecard: full-service hospital vs urgent-care lean, plus an avoid-gate on addressable demand (needs the Census volume layer). |
| `marketfit` | — | Brand/retailer: rank markets for a product category/format, **or** read one metro's assortment emphasis. |
| `derive-affinities` | — | Respondent microdata → empirical persona × category affinity table that feeds `marketfit --npos-affinities`. |
| `certoverlay` | census (geography) | Overlay a city list (default: Mars "Better Cities for Pets") onto the viability grades — does an external footprint sit in high-opportunity metros? |

```bash
# The complete package: every metro graded A-D on persona-value x income x
# demand, with the vet-siting recommendation, reliability-filtered. Writes
# both .csv and .xlsx.
python -m zip_msa_personas viability --enriched E.csv --distributions D.csv \
    --census-key $CENSUS_KEY --min-survey 3 --out market_viability_vetsiting.csv

# How a partner's city list (Better Cities for Pets, bundled) maps to the grades
python -m zip_msa_personas certoverlay --enriched E.csv \
    --viability market_viability_vetsiting.csv --out cert_overlay.csv

# Vet group: where to build a hospital, an urgent care, or avoid
python -m zip_msa_personas vetsiting --enriched E.csv --distributions D.csv \
    --census-key $CENSUS_KEY --out vet_scorecard.csv

# Brand: rank metros for a category, or read a metro's assortment
python -m zip_msa_personas marketfit --enriched E.csv --distributions D.csv \
    --category "Premium / fresh food" --out premium_markets.csv
python -m zip_msa_personas marketfit --enriched E.csv --distributions D.csv \
    --assortment-msa "Orlando-Kissimmee-Sanford, FL"

# Replace the seeded affinity weights with empirical ones from NPOS microdata
python -m zip_msa_personas derive-affinities --microdata respondents.xlsx \
    --weight-col survey_weight --out npos_affinities.csv
python -m zip_msa_personas marketfit --enriched E.csv --distributions D.csv \
    --npos-affinities npos_affinities.csv --category "Functional / health"
```

### Building the deliverable kit

| Command | Network | Purpose |
|---|---|---|
| `deliverables` | — | One command → the Excel workbook + US persona maps + per-persona one-pagers, from the official outputs. `--preview` toggles the preview footer. |

```bash
python -m zip_msa_personas deliverables --enriched E.csv --distributions D.csv --outdir kit
# -> kit/workbook.xlsx, kit/maps/, kit/onepagers/
```

---

## End-to-end recipes

### A. First real national run (Census-enabled session)
```bash
python -m zip_msa_personas official --appa NPOS.xlsx --year 2022 \
    --census-key $CENSUS_KEY --model blend --outdir out_official
python -m zip_msa_personas deliverables \
    --enriched out_official/enriched_national_official.csv \
    --distributions out_official/persona_distributions.csv --outdir kit
# commit RUN_NOTES.md updates; upload kit/ + out_official/*.csv out-of-band
```

### B. Advise a corporate vet group
```bash
python -m zip_msa_personas vetsiting \
    --enriched out_official/enriched_national_official.csv \
    --distributions out_official/persona_distributions.csv \
    --census-key $CENSUS_KEY --out vet_scorecard.csv
```

### C. Advise a pet brand / retailer
```bash
python -m zip_msa_personas marketfit \
    --enriched out_official/enriched_national_official.csv \
    --distributions out_official/persona_distributions.csv \
    --category "Premium / fresh food" --out premium_markets.csv
```

### D. One-shot local run (machine with full internet)
```bash
scripts/run_local.sh --appa NPOS.xlsx [--zip-dma licensed_zip_dma.csv] [--outdir ./out_local] [--venv]
# chains ingest -> reference fetch -> calibrate -> national -> validate -> rights-safe export
```

---

## Reliability filter (`--min-survey`)

`vetsiting`, `marketfit`, and `query --top-persona` each accept `--min-survey`
(default **3**): a market is only trusted at the top of a ranking if at least
that many of its ZIPs were reached by an actual survey response (`survey_zips`).
This is the guard against the *Kankakee artifact* — a tiny, all-modeled market
spiking to the top of a list on smoothed noise. The persona index is still
computed against the full national mean; the filter only governs which markets
*rank*, and the full flagged ranking (every market, with `survey_zips` +
`reliable`) is always written to the output CSV. Set `--min-survey 0` to disable.

## Flag conventions

- `--demo` runs the command on bundled synthetic data with no network.
- `--census-key` is accepted by every networked command; it overrides
  `CENSUS_API_KEY` and is passed only at runtime.
- `--out` / `--outdir` set the output path(s); defaults are noted in `-h`.
- `--k` (spatial neighbors), `--shrink-alpha` (prior strength), and
  `--min-zips` (drop tiny metros) are the main tuning knobs.

See [`METHODOLOGY.md`](./METHODOLOGY.md) for what each stage does and how far to
trust its output.
