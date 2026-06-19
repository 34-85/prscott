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

## Real run

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

## Lineage — every row is auditable

Each output row is stamped with `methodology_version`, `data_vintage`,
`model_params`, and `evidence` — for an estimate, the actual look-alike ZIPs (or
baseline) that produced it. This is what lets you answer a customer's "where did
this number come from?"

## Commercial path

See [`ROADMAP.md`](./ROADMAP.md). Short version: first-party personas + public-
domain Census/HUD means **no redistribution constraints**. Recommended sequence
is **file delivery → API → self-serve**, all over this same core library.

## Layout

```
zip_msa_personas/
  data_sources.py  # the only networked module: HUD/Census fetch + cache
  crosswalk.py     # Stage 1: ZIP -> Metro MSA (dominant assign)
  personas.py      # Stage 2: load + aggregate your persona file
  impute.py        # Stage 3: similarity imputation + disclosed extrapolation
  pipeline.py      # orchestration
  cli.py           # demo / data / run
  demo.py          # synthetic fixtures for the offline demo
tests/test_pipeline.py
data/demo/         # sample persona + feature CSVs
```
