# ZIP → MSA → Persona enrichment pipeline

Match ZIP codes to metro areas, attach your persona data, and estimate personas
for the (many) ZIPs you have no data for — with every estimate honestly labeled
by how it was produced.

## The three questions this answers

1. **Match ZIPs to MSAs.** A deterministic lookup against the official HUD
   ZIP→CBSA crosswalk + the OMB CBSA delineation. Policy here: **Metropolitan
   Statistical Areas only**, **dominant assignment** (each ZIP → the single MSA
   holding the largest share of its residential addresses).
2. **Attach personas.** Join your `(zip, persona[, weight])` file. Most ZIPs
   will have no data — that's expected and handled explicitly.
3. **Estimate empty ZIPs.** For ZIPs with no persona data, predict one from
   demographically similar ZIPs that *do* have data; for ZIPs that resemble
   nothing observed, fall back to a baseline and **disclose it** as a
   low-confidence extrapolation.

## Provenance — nothing modeled is mistaken for fact

Every output ZIP carries a `provenance` label and a `confidence` score:

| provenance | meaning | confidence |
|---|---|---|
| `observed` | from your file (ground truth) | high |
| `imputed_similar` | empty ZIP, predicted from look-alike observed ZIPs | medium (data-driven) |
| `extrapolated_baseline` | empty ZIP unlike anything observed; MSA/national baseline | **low — disclosed** |

The "similar enough" cutoff is **data-driven**: it's a high percentile of the
distances between observed ZIPs in feature space, not a hand-picked constant.

## Quick start

```bash
pip install -r requirements.txt

# See it work end-to-end on bundled synthetic data (no network needed):
python -m zip_msa_personas demo --out enriched_demo.csv
```

## One-command local run (recommended)

On a machine with normal internet (HUD + Census reachable), the whole pipeline
runs in one command. Your proprietary NPOS data never leaves your machine.

```bash
scripts/run_local.sh --appa NPOS_zip_by_segment.xlsx \
    [--zip-dma your_licensed_zip_dma.csv] [--outdir ./out_local] [--venv]
```

It chains: ingest-appa → fetch reference data → calibrate → national scoring
(MSA, plus DMA if a crosswalk is given) → validate → rights-safe export. Outputs
land in `--outdir`: tidy personas, the fitted calibrator, enriched national
files, coverage CSVs, a validation report, and the sellable `deliverable_*.csv`
(+ rights manifest).

## Real run (manual steps)

```bash
# 1. Fetch + cache the official reference data (needs census.gov + huduser.gov).
python -m zip_msa_personas data

# 2. Run on your persona file. Features default to the cached ACS pull.
python -m zip_msa_personas run \
    --personas your_personas.csv \
    --out enriched_zips.csv
```

Your persona file just needs a ZIP column and a persona column (names are
auto-detected: `zip`/`zipcode`/`postal_code`, `persona`/`segment`/`audience`);
an optional `weight`/`count` column lets one ZIP carry several personas.

### Network note
The official sources are `huduser.gov` (ZIP→CBSA crosswalk) and `census.gov`
(CBSA delineation + ACS features). Some managed/sandboxed environments allow
only an allowlist of hosts — if those two are blocked, run locally or add them
to the egress policy. Everything except `data`/`run`'s live fetch works offline,
and you can always supply your own `--features` CSV.

## Validation — is the confidence trustworthy?

The estimate is only sellable if its confidence is *calibrated*. The backtest
hides observed ZIPs, predicts them through the production path, and reports
empirical accuracy per confidence band:

```bash
python -m zip_msa_personas validate --demo          # on synthetic data
python -m zip_msa_personas validate --personas your.csv   # on real data
```

You want (a) a low calibration error, (b) accuracy that rises with confidence,
and (c) `imputed_similar` beating `extrapolated_baseline`. On the bundled demo
all three hold.

### Calibrated confidence (so 0.80 *means* 80%)

`calibrate` fits an isotonic map from raw confidence to empirical accuracy on the
backtest's held-out predictions, reports the **held-out** ECE improvement, and
saves a portable calibrator. Apply it on `run`/`national` and `confidence`
becomes a true probability (raw kept in `confidence_raw`; observed rows, being
ground truth, are left untouched).

```bash
python -m zip_msa_personas calibrate --demo --out calibrator.json
python -m zip_msa_personas national  --demo --calibrator calibrator.json --out enriched.csv
```

Note: calibration needs sample size. On the tiny demo it's roughly neutral (the
heuristic is already decent and 20-ish held-out points are noisy); on real
national NPOS data with thousands of observed ZIPs it has the data to both help
and to measure the gain reliably.

## Lineage — every row is auditable

Each output row is stamped with `methodology_version`, `data_vintage`,
`model_params`, and `evidence` — for an estimate, the actual look-alike ZIPs (or
baseline) that produced it. This is what lets you answer a customer's "where did
this number come from?"

## APPA NPOS data: ingest + sparse-ZIP shrinkage

The NPOS export is a survey-weighted ZIP×segment matrix (7 pet-owner segments)
that is **thin at ZIP level** (median ~1 weighted respondent; 79% of ZIPs < 2).

```bash
python -m zip_msa_personas ingest-appa --input NPOS_zip_by_segment.xlsx \
    --out appa_personas.csv
```

Because a single respondent is not a distribution, the pipeline applies
**empirical-Bayes shrinkage** (`shrinkage.py`): each ZIP's persona mix is pulled
toward its market (MSA/DMA, national fallback) prior, weighted by sample size, so
thin ZIPs no longer score ~1.0 confidence. It's on by default (`--shrink-alpha 5`,
set 0 to disable). On the real data this moves observed-tier mean confidence from
an overconfident 0.94 (74% at 1.0) to an honest ~0.30.

## DMA (Nielsen market) geography

DMA is first-class alongside MSA. Because the ZIP→DMA mapping is Nielsen IP
(unlike public-domain HUD/Census), you supply your **licensed crosswalk file**;
the loader autodetects zip / DMA-code / DMA-name columns and normalizes to one
DMA per ZIP. DMA codes from the NPOS DMA sheet (`501 - NEW YORK` → `501`) join
straight to it.

```bash
python -m zip_msa_personas national --personas appa_personas.csv \
    --zip-dma your_licensed_zip_dma.csv --market dma
```

`--market dma` makes the DMA the prior that thin ZIPs shrink toward; `dma_code`
/ `dma_name` are added to the output (rights-tagged `nielsen_dma` — confirm your
license permits redistributing DMA assignments, else flip to internal in
`rights.py`).

## National scoring + coverage

Score the full ZCTA universe and report how much of the country is observed vs
modeled vs disclosed-extrapolated — nationally, by metro/non-metro, and per MSA:

```bash
python -m zip_msa_personas national --demo --out enriched_national.csv
# real: --personas your.csv --data-vintage "NPOS2024;ACS2022;HUD2023Q4"
```

## Opportunity scoring (persona ↔ offer ↔ location fit)

Rank ZIPs/MSAs by fit to a client's target personas, sized by addressable
population, with whitespace (strong fit, no presence) flagged. Estimate-aware:
opportunity built on modeled ZIPs is discounted by confidence and the
observed-vs-estimated split is reported.

```bash
python -m zip_msa_personas opportunity --demo --enriched enriched_national.csv \
    --out opportunity_zips.csv
# real: --targets targets.json  --sizes zip_features.csv  --footprint stores.csv
```

`targets.json` is just `{"Affluent Empty-Nesters": 1.0, "Urban Professionals": 0.8}`.

## Rights-safe delivery

Licensed sources (e.g. Experian Mosaic) must never leak into a sellable file.
`rights.py` tags every field by license class and the export strips anything
non-resellable by construction, writing a rights manifest alongside:

```bash
python -m zip_msa_personas export --input enriched_zips.csv --out deliverable.csv
```

Mosaic, if used, stays an **internal confirmation** signal via
`validation.concordance` (measures persona↔Mosaic alignment without
redistributing Mosaic labels) — never an enrichment field in the output.

## Commercial path

See [`ROADMAP.md`](./ROADMAP.md). Short version: first-party pet-owner personas +
public-domain Census/HUD means **no redistribution constraints**. Recommended
sequence is **file delivery → opportunity scoring → API → self-serve**, all over
this same core library.

## Layout

```
zip_msa_personas/
  data_sources.py  # the only networked module: HUD/Census fetch + cache
  crosswalk.py     # Stage 1: ZIP -> Metro MSA (dominant assign)
  personas.py      # Stage 2: load + aggregate your persona file
  impute.py        # Stage 3: similarity imputation + disclosed extrapolation
  shrinkage.py     # empirical-Bayes shrinkage of thin survey ZIPs toward market prior
  calibration.py   # isotonic confidence calibration (confidence -> true probability)
  appa_loader.py   # parse the APPA NPOS ZIP/DMA segmentation workbook -> tidy
  pipeline.py      # orchestration
  batch.py         # national scoring + coverage report
  opportunity.py   # persona <-> offer <-> location fit scoring
  validation.py    # backtest/calibration + external concordance (Mosaic)
  rights.py        # license tagging + rights-safe export
  cli.py           # demo / data / run / national / coverage / opportunity / validate / export
  demo.py          # synthetic fixtures for the offline demo
tests/test_pipeline.py
data/demo/         # sample persona + feature CSVs
```
