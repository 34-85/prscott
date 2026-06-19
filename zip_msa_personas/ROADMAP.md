# Commercialization roadmap

Turning the ZIP→MSA→persona engine into a product. The core library stays the
same across every phase; each phase wraps it in more surface area.

## Product
Built and owned by **APPA**. Geo-located **pet-owner personas**: APPA's
proprietary pet-owner segmentation, grounded in the **APPA National Pet Owners
Survey (NPOS)** — APPA's own longitudinal industry benchmark running since 1998
— mapped to every ZIP/MSA in the country. Buyers — pet **brands**, **retailers**,
and **veterinarians** (largely APPA's own ecosystem) — use it to position
products, stores, clinics, and services where persona↔offer fit is strongest.

The moat: nobody else owns 25+ years of authoritative pet-ownership data. This
isn't reselling someone's data — it's APPA productizing the canonical source.

## Data sources & rights (enforced in `rights.py`)
| Source | Class | Notes |
|---|---|---|
| APPA pet-owner segmentation | **Resellable** | First-party IP (owned). |
| APPA National Pet Owners Survey (NPOS) | **Resellable** | First-party — APPA's own data, published since 1998. No third-party terms. |
| Census ACS, HUD, OMB delineation | **Resellable** | Public domain. |
| Experian Mosaic | **Internal only** | Optional. Validation/confirmation ONLY. No Mosaic-derived field enters a deliverable without a written redistribution/syndication license. Not legal advice — have counsel read the "derivative works" + "redistribution" clauses. |

`export_deliverable` strips internal-only fields by construction and writes a
rights manifest, so a licensed source can never leak into a sellable file by
accident. Unknown fields fail safe to internal-only.

## Mosaic as confirmation (not enrichment)
`validation.concordance` measures how strongly our personas align with an
external segmentation (NMI / adjusted Rand) over shared ZIPs — a credibility
signal ("independently corroborated by Experian Mosaic") that keeps Mosaic
internal and redistributes none of its labels.

## The product is the *estimate*, not the lookup
Stages 1–2 (ZIP→MSA, the join) are commodity. Stage 3 (estimating empty ZIPs)
is the only sellable asset, and only if its confidence is **calibrated**. The
`validation` module is therefore the center of gravity, not a nice-to-have.

## Phases

### Phase 1 — File / data delivery  ← start here  ✅ engine built
Run national scoring per engagement; deliver a lineage-tagged CSV/Parquet.
- Near-zero infra; validates that estimates are good *and* valued before
  platform spend.
- Built: `batch.run_national` scores all feature-bearing ZIPs and emits a
  coverage report (observed/modeled/extrapolated, nationally + by metro + per
  MSA); calibration report (`validate`) and rights-safe export ship alongside.
- Remaining: pin data vintages on real NPOS/ACS/HUD; Parquet output option.

### Phase 2 — Opportunity scoring  ✅ engine built
A scoring layer *on top* of persona-by-ZIP. Given a client's target personas
(e.g. a premium-food brand's high-spend pet owners, or a vet chain's segments),
rank ZIPs / MSAs / trade areas by **persona↔offer fit**:
- Inputs: client's target persona weights + (optionally) their store/clinic
  footprint and category sales.
- Output: ranked locations with fit score, addressable opportunity, and
  whitespace ("strong fit, no presence") — what a brand or vet actually pays for.
- Built: `opportunity.score_opportunity` — estimate-aware (fit x confidence x
  size), reports observed-vs-estimated addressable split, flags whitespace.
- Remaining: trade-area (drive-time) rollups; category-sales weighting.

### Phase 3 — API / SaaS
Same engine behind an endpoint (single ZIP + batch). Add when customers want
on-demand lookups in their own apps.
- Build: API layer, results store keyed by (zip, methodology_version,
  data_vintage), auth, rate limits, scheduled re-scoring on new data vintages.

### Phase 4 — Self-serve / dashboard
Only if the market pulls you there. Upload personas → get scored file + a
calibration/coverage report + opportunity maps.

## Engineering backlog (priority order)
1. **Calibration hardening** — isotonic/Platt scaling so confidence is a true
   probability; per-MSA and per-persona calibration curves.
2. **Coverage reporting** — % of national ZIPs in each provenance tier, so a
   customer sees how much is observed vs modeled vs disclosed-extrapolated.
3. **Data-vintage pinning + refresh job** — never silently float ACS/HUD; stamp
   and re-score deliberately.
4. **Model upgrade path** — keep k-NN (explainable) as the baseline; only move to
   a richer model if validation shows it's the bottleneck. Always keep an
   explainable fallback for sales conversations.
5. **Richer features** — expand the ACS variable set; consider commute, housing
   tenure, family structure as persona predictors.
6. **Privacy/compliance review** — ZIP-level aggregates avoid PII, but document
   the inference method and keep the extrapolation disclosure (liability cover).

## What NOT to do yet
- No dashboard before file delivery proves demand.
- No black-box model you can't explain to a buyer.
- No floating to "latest" data without an explicit vintage bump.
