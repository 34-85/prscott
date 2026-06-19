# Commercialization roadmap

Turning the ZIP→MSA→persona engine into a product. The core library stays the
same across every phase; each phase wraps it in more surface area.

## Position
- **Persona data:** first-party. **Reference data:** Census + HUD (public domain).
- **Consequence:** no third-party redistribution constraints — the scored output
  is yours to sell. Keep lineage clean so provenance is always provable.

## The product is the *estimate*, not the lookup
Stages 1–2 (ZIP→MSA, the join) are commodity. Stage 3 (estimating empty ZIPs)
is the only sellable asset, and only if its confidence is **calibrated**. The
`validation` module is therefore the center of gravity, not a nice-to-have.

## Phases

### Phase 1 — File / data delivery  ← start here
Run national scoring per engagement; deliver a lineage-tagged CSV/Parquet.
- Near-zero infra; validates that estimates are good *and* valued before
  platform spend.
- Build: hardened batch runner over all ~33k ZCTAs, pinned data vintages,
  calibration report shipped alongside every delivery.

### Phase 2 — API / SaaS
Same engine behind an endpoint (single ZIP + batch). Add when customers want
on-demand lookups in their own apps.
- Build: API layer, results store keyed by (zip, methodology_version,
  data_vintage), auth, rate limits, scheduled re-scoring on new data vintages.

### Phase 3 — Self-serve / dashboard
Only if the market pulls you there. Upload personas → get scored file + a
calibration/coverage report.

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
