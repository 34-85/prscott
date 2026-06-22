"""Command-line entry point.

    python -m zip_msa_personas demo                 # full run on synthetic data
    python -m zip_msa_personas data                 # fetch + cache real reference data
    python -m zip_msa_personas run \
        --personas your_personas.csv \
        --features zip_features.csv \
        --out enriched_zips.csv

For the real ``run``, --features defaults to the cached ACS pull from ``data``.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

import json

from . import demo as demo_mod
from . import appa_loader, batch, calibration, crosswalk, impute, opportunity, personas, pipeline, rights, validation
from .data_sources import DataUnavailable, load_acs_zcta_features, load_reference_data, load_zip_dma_crosswalk


def _print_summary(out: pipeline.PipelineOutput) -> None:
    res = out.impute_result
    print("\n=== Provenance summary (every ZIP is labeled) ===")
    print(impute.summarize(res).to_string(index=False))
    print(f"\nData-driven similarity threshold: {res.threshold:.4f}")
    print("Tiers: observed = your data | imputed_similar = modeled from lookalikes |")
    print("       extrapolated_baseline = DISCLOSED low-confidence estimate.\n")
    print("=== Sample of each tier ===")
    a = out.enriched
    for tier in [impute.OBSERVED, impute.IMPUTED, impute.EXTRAPOLATED]:
        sub = a[a["provenance"] == tier].head(3)
        if not sub.empty:
            print(f"\n[{tier}]")
            print(sub[["zip", "msa_title", "persona", "confidence", "provenance"]].to_string(index=False))


def cmd_demo(args) -> int:
    ref, features, personas = demo_mod.make_demo()
    tmp = Path(args.out).parent / "_demo_personas.csv"
    personas.to_csv(tmp, index=False)
    out = pipeline.run_pipeline(tmp, ref, features, config=impute.ImputeConfig(k=args.k))
    out.enriched.to_csv(args.out, index=False)
    _print_summary(out)
    print(f"\nWrote {len(out.enriched)} enriched ZIP rows -> {args.out}")
    tmp.unlink(missing_ok=True)
    return 0


def cmd_data(_args) -> int:
    try:
        ref = load_reference_data()
        feats = load_acs_zcta_features()
    except DataUnavailable as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print(
            "\nThis environment likely blocks census.gov / huduser.gov. Run locally "
            "or add those hosts to the network egress allowlist, then retry.",
            file=sys.stderr,
        )
        return 2
    print(f"Cached ZIP->CBSA crosswalk: {len(ref.zip_cbsa)} rows")
    print(f"Cached CBSA metadata: {len(ref.cbsa_meta)} CBSAs")
    print(f"Cached ACS ZCTA features: {len(feats)} ZCTAs")
    return 0


def cmd_official(args) -> int:
    """Full-resolution official run: ACS demographics -> propensity -> survey blend.

    Needs census.gov + huduser.gov reachable (allowlist or local). Produces the
    national enriched dataset, coverage report, and full per-ZIP distributions.
    """
    from . import acs, batch
    if args.census_key:
        import os
        os.environ["CENSUS_API_KEY"] = args.census_key
    try:
        dmix = acs.demographic_mix(args.year)            # ACS fetch + propensity scoring
    except DataUnavailable as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print("Allowlist api.census.gov and set --census-key / CENSUS_API_KEY, then retry.", file=sys.stderr)
        return 2
    try:
        ref = load_reference_data()                      # HUD ZIP->CBSA + OMB delineation
    except DataUnavailable as e:
        print(f"WARNING: ZIP->MSA reference data unavailable ({e}).", file=sys.stderr)
        print("Proceeding demographics-only; MSA labels will be blank.", file=sys.stderr)
        ref = None

    personas_csv = _write_tmp(appa_loader.load_appa_segmentation(args.appa)[["zip", "persona", "weight"]]) \
        if str(args.appa).lower().endswith((".xlsx", ".xls")) else args.appa
    z2d = load_zip_dma_crosswalk(args.zip_dma) if args.zip_dma else None

    # National calibration: rake the demographic mix so its national average mix
    # matches the survey's known segment sizes. Without this the raw propensity
    # over-weights broad signals (white/Boomer), producing an argmax artifact
    # (e.g. ~57% "dominant" Comfort Companions vs a ~17% true share).
    from . import propensity, validation as _val
    surv = personas.aggregate_to_zip_distribution(personas.load_personas(personas_csv))

    # Credibility check: does the RAW demographic model reproduce the surveyed
    # mix? Aggregate to MSA (where the survey is reliable) and compare.
    sv = surv[["zip", "persona", "weight"]]
    if ref is not None:
        try:
            gmap = dict(zip(ref.zip_cbsa["zip"].astype(str).str.zfill(5), ref.zip_cbsa["cbsa"]))
            print("\n=== Demographic model vs survey (raw model, MSA-level) ===")
            print(_val.validate_model_vs_survey(dmix, sv, group_map=gmap))
        except Exception as e:  # noqa: BLE001
            print(f"(MSA-level validation skipped: {str(e)[:100]})")
    # Region level: far more survey per unit -> a stabler read of the signal.
    try:
        from .data_sources import load_zcta_state
        region_map = _val.census_region_map(load_zcta_state())
        print("\n=== Demographic model vs survey (raw model, Census-region level) ===")
        print(_val.validate_model_vs_survey(dmix, sv, group_map=region_map, min_n=100))
    except Exception as e:  # noqa: BLE001
        print(f"(region-level validation skipped: {str(e)[:100]})")

    tw = surv.groupby("persona")["weight"].sum()
    target = {p: float(tw.get(p, 0.0)) for p in dmix.columns}

    def _cal(mix):  # rake a mix so its national average matches the survey
        if args.no_calibrate_national:
            return mix
        return propensity.apply_national_calibration(mix, propensity.fit_national_calibration(mix, target))

    # Choose the predictor for the modeled (non-survey) ZIPs. Bake-off result:
    # spatial smoothing >> demographics; blend wins on dominant-persona hit rate.
    dmix_cal = _cal(dmix)
    if args.model == "demographic":
        model_mix = dmix_cal
    else:
        from . import spatial, deliverables
        sw = (surv.assign(zip=surv["zip"].astype(str).str.zfill(5))
              .groupby(["zip", "persona"])["weight"].sum().unstack(fill_value=0.0)
              .reindex(columns=dmix.columns, fill_value=0.0))
        survey_wide = sw.div(sw.sum(axis=1).replace(0, 1.0), axis=0)
        geo = deliverables.load_geography().set_index("zip")[["lat", "lon"]]
        smix = _cal(spatial.spatial_predict(survey_wide, geo, geo, k=args.k))
        model_mix = smix if args.model == "spatial" else _cal(spatial.blend_full(smix, dmix_cal))
    print(f"Predictor for modeled ZIPs: {args.model} (calibrated to survey national mix).")

    out = pipeline.run_demographic_blend(
        personas_csv, ref, model_mix, alpha=args.shrink_alpha, data_vintage=args.data_vintage, zip_to_dma=z2d,
    )
    Path(args.outdir).mkdir(parents=True, exist_ok=True)
    out.enriched.to_csv(Path(args.outdir) / "enriched_national_official.csv", index=False)
    out.impute_result.distributions.to_csv(Path(args.outdir) / "persona_distributions.csv", index=False)
    cov = batch.coverage_report(out.enriched)
    cov.write(Path(args.outdir) / "coverage")
    print(cov)
    wide = out.impute_result.distributions.pivot_table(index="zip", columns="persona", values="share", fill_value=0.0)
    nm = propensity.national_mix(wide)
    print("\nNational AVERAGE persona mix (the real headline -- not the argmax 'dominant' count):")
    print((nm * 100).round(1).to_string())
    print(f"\nScored {len(out.enriched):,} ZIPs from ACS demographics, anchored by the survey.")
    print(f"Outputs -> {args.outdir}/")
    return 0


def cmd_bakeoff(args) -> int:
    """Predictor bake-off: demographic vs spatial vs blend, on real survey data."""
    from . import acs, deliverables, spatial
    if args.census_key:
        import os
        os.environ["CENSUS_API_KEY"] = args.census_key
    dmix = acs.demographic_mix(args.year)
    ref = load_reference_data()
    survey = appa_loader.load_appa_segmentation(args.appa)[["zip", "persona", "weight"]]
    geo = deliverables.load_geography().set_index("zip")
    group_map = dict(zip(ref.zip_cbsa["zip"].astype(str).str.zfill(5), ref.zip_cbsa["cbsa"]))
    table = spatial.compare_predictors(survey, dmix, geo[["lat", "lon"]], group_map, k=args.k)
    print("=== Predictor bake-off (MSA-level, held-out) ===")
    print(table.to_string(index=False))
    print("\nHigher 'lift' (directional - chance) and lower 'mae' = better for the modeled ZIPs.")
    return 0


def cmd_query(args) -> int:
    """Plain-language lookups against the scored dataset."""
    from . import query
    enr = pd.read_csv(args.enriched, dtype={"zip": str})
    dist = pd.read_csv(args.distributions, dtype={"zip": str})
    if args.zip:
        print(f"Persona mix for ZIP {args.zip}:")
        print(query.mix_for_zip(dist, args.zip).to_string())
        print("\n" + query.siting_read(enr, dist, args.zip))
    elif args.group and args.group_col:
        print(f"Average persona mix for {args.group_col} ~ '{args.group}':")
        print(query.mix_for_group(enr, dist, args.group_col, args.group).to_string())
    elif args.top_persona:
        print(f"Top {args.n} {args.group_col} by {args.top_persona} share:")
        print(query.top_markets_for_persona(enr, dist, args.top_persona, args.group_col, args.n).to_string(index=False))
    else:
        print("Specify --zip, or --group-col + --group, or --top-persona.")
    return 0


def cmd_deliverables(args) -> int:
    """Build the workbook + maps + one-pagers from the official outputs."""
    from . import deliverables
    enr = pd.read_csv(args.enriched, dtype={"zip": str})
    dist = pd.read_csv(args.distributions, dtype={"zip": str})
    out = deliverables.build_deliverables(enr, dist, args.outdir, is_preview=args.preview)
    print(f"Deliverable kit written to {out}/ (workbook, maps/, onepagers/)")
    return 0


def cmd_ingest_appa(args) -> int:
    """Convert the APPA NPOS 'ZIP by segment' workbook to a tidy personas CSV."""
    long = appa_loader.load_appa_segmentation(args.input)
    long[["zip", "persona", "weight"]].to_csv(args.out, index=False)
    print(appa_loader.summarize(long))
    print(f"\nWrote tidy personas -> {args.out}")
    print("Next:  national --personas " + args.out + "  (needs census.gov/huduser.gov)")
    return 0


def cmd_national(args) -> int:
    """Score the full ZCTA universe and write enriched output + coverage report."""
    if args.demo:
        ref, features, persona_df = demo_mod.make_demo()
        ppath = _write_tmp(persona_df)
        vintage = "DEMO"
    else:
        try:
            ref = load_reference_data()
        except DataUnavailable as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 2
        features = pd.read_csv(args.features, dtype={"zip": str}) if args.features else load_acs_zcta_features()
        features["zip"] = features["zip"].astype(str).str.zfill(5)
        ppath = args.personas
        vintage = args.data_vintage
    calib = calibration.Calibrator.load(args.calibrator) if args.calibrator else None
    z2d = load_zip_dma_crosswalk(args.zip_dma) if (args.zip_dma or args.market == "dma") else None
    out, cov = batch.run_national(
        ppath, ref, features, config=impute.ImputeConfig(k=args.k), data_vintage=vintage,
        calibrator=calib, shrink_alpha=args.shrink_alpha, zip_to_dma=z2d, market=args.market,
    )
    out.enriched.to_csv(args.out, index=False)
    cov_dir = Path(args.out).with_suffix("")
    cov.write(f"{cov_dir}_coverage")
    print(cov)
    print(f"\nWrote {len(out.enriched)} enriched ZIP rows -> {args.out}")
    print(f"Coverage CSVs -> {cov_dir}_coverage/")
    return 0


def cmd_coverage(args) -> int:
    enriched = pd.read_csv(args.input, dtype={"zip": str})
    print(batch.coverage_report(enriched))
    return 0


def cmd_opportunity(args) -> int:
    """Rank ZIPs/MSAs by persona<->offer fit for a client's target personas."""
    enriched = pd.read_csv(args.enriched, dtype={"zip": str})
    if args.demo and not args.targets:
        # A premium pet brand targeting affluent + urban segments.
        targets = {"Affluent Empty-Nesters": 1.0, "Urban Professionals": 0.8}
        sizes = demo_mod.make_demo()[1]
    else:
        targets = json.loads(Path(args.targets).read_text()) if args.targets else json.loads(args.targets_inline)
        sizes = pd.read_csv(args.sizes, dtype={"zip": str}) if args.sizes else None
    footprint = None
    if args.footprint:
        footprint = pd.read_csv(args.footprint, dtype={"zip": str})["zip"].tolist()
    result = opportunity.score_opportunity(enriched, targets, sizes=sizes, footprint_zips=footprint)
    result.zip_scores.to_csv(args.out, index=False)
    print(result)
    ws = int(result.zip_scores["whitespace"].sum())
    print(f"\nWhitespace ZIPs (strong fit, not in footprint): {ws}")
    print(f"Wrote per-ZIP opportunity scores -> {args.out}")
    return 0


def cmd_export(args) -> int:
    """Strip non-resellable fields and write a deliverable + rights manifest."""
    df = pd.read_csv(args.input, dtype=str)
    manifest = rights.export_deliverable(df, args.out, include_internal=args.include_internal)
    print(f"Deliverable -> {args.out}")
    print(f"Manifest    -> {Path(args.out).with_suffix('.manifest.json')}")
    print(f"Included {len(manifest.included)} fields; excluded {len(manifest.excluded)}: {manifest.excluded or 'none'}")
    if manifest.excluded and not args.include_internal:
        print("Excluded fields came from internal-only (licensed) sources -- correct for a sellable file.")
    return 0


def _load_backtest_inputs(args):
    if args.demo:
        ref, features, persona_df = demo_mod.make_demo()
        dist = personas.aggregate_to_zip_distribution(personas.load_personas(_write_tmp(persona_df)))
    else:
        ref = load_reference_data()
        features = pd.read_csv(args.features, dtype={"zip": str}) if args.features else load_acs_zcta_features()
        features["zip"] = features["zip"].astype(str).str.zfill(5)
        dist = personas.aggregate_to_zip_distribution(personas.load_personas(args.personas))
    z2m = crosswalk.build_zip_to_msa(ref)
    z2m = z2m[z2m["zip"].isin(set(features["zip"]))]
    return features, dist, z2m


def cmd_validate(args) -> int:
    """Cross-validated calibration report -- run on demo or real data."""
    features, dist, z2m = _load_backtest_inputs(args)
    report = validation.backtest(features, dist, z2m, config=impute.ImputeConfig(k=args.k))
    print(report)
    return 0


def cmd_calibrate(args) -> int:
    """Fit an isotonic calibrator so confidence becomes a true probability."""
    features, dist, z2m = _load_backtest_inputs(args)
    report = validation.backtest(features, dist, z2m, config=impute.ImputeConfig(k=args.k))
    metrics = calibration.evaluate_calibration(report.predictions)   # honest held-out estimate
    calib = calibration.fit_calibrator(report.predictions)           # production: fit on all data
    calib.save(args.out)
    scope = "held-out test" if metrics["held_out"] else "in-sample (too little data to hold out)"
    print(f"Isotonic calibration. ECE measured on {metrics['n']} {scope} predictions:")
    print(f"  ECE: {metrics['ece_before']:.4f} -> {metrics['ece_after']:.4f} (lower is better)")
    print(f"  Improvement: {metrics['ece_before'] - metrics['ece_after']:+.4f}")
    print(f"Production calibrator fit on all {calib.n_train} estimated predictions.")
    print(f"Saved calibrator -> {args.out}")
    print("Apply it with:  run/national --calibrator " + args.out)
    return 0


def _write_tmp(df: pd.DataFrame) -> str:
    import tempfile
    fd, path = tempfile.mkstemp(suffix=".csv")
    import os
    os.close(fd)
    df.to_csv(path, index=False)
    return path


def cmd_run(args) -> int:
    try:
        ref = load_reference_data()
    except DataUnavailable as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
    features = (
        pd.read_csv(args.features, dtype={"zip": str})
        if args.features
        else load_acs_zcta_features()
    )
    features["zip"] = features["zip"].astype(str).str.zfill(5)
    calib = calibration.Calibrator.load(args.calibrator) if args.calibrator else None
    z2d = load_zip_dma_crosswalk(args.zip_dma) if (args.zip_dma or args.market == "dma") else None
    out = pipeline.run_pipeline(
        args.personas, ref, features, config=impute.ImputeConfig(k=args.k),
        calibrator=calib, shrink_alpha=args.shrink_alpha, zip_to_dma=z2d, market=args.market,
    )
    out.enriched.to_csv(args.out, index=False)
    _print_summary(out)
    print(f"\nWrote {len(out.enriched)} enriched ZIP rows -> {args.out}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="zip_msa_personas", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    pd_ = sub.add_parser("demo", help="run end-to-end on bundled synthetic data")
    pd_.add_argument("--out", default="enriched_demo.csv")
    pd_.add_argument("--k", type=int, default=10)
    pd_.set_defaults(func=cmd_demo)

    pdd = sub.add_parser("data", help="fetch + cache real HUD/Census reference data")
    pdd.set_defaults(func=cmd_data)

    pof = sub.add_parser("official", help="full-resolution run: ACS demographics -> propensity -> survey blend")
    pof.add_argument("--appa", required=True, help="APPA NPOS workbook (.xlsx) or tidy personas CSV")
    pof.add_argument("--zip-dma", default=None, help="licensed ZIP->DMA crosswalk file")
    pof.add_argument("--year", type=int, default=2022, help="ACS 5-year vintage")
    pof.add_argument("--census-key", default=None, help="Census API key (passed at runtime; overrides CENSUS_API_KEY env)")
    pof.add_argument("--no-calibrate-national", action="store_true",
                     help="skip raking the model mix to the survey's national segment sizes")
    pof.add_argument("--model", choices=["blend", "spatial", "demographic"], default="blend",
                     help="predictor for modeled ZIPs (bake-off: spatial/blend >> demographic)")
    pof.add_argument("--k", type=int, default=10, help="neighbors for spatial prediction")
    pof.add_argument("--shrink-alpha", type=float, default=5.0, help="prior strength for the survey blend")
    pof.add_argument("--data-vintage", default="NPOS2025;ACS2022;HUD2023Q4")
    pof.add_argument("--outdir", default="out_official")
    pof.set_defaults(func=cmd_official)

    pbo = sub.add_parser("bakeoff", help="compare demographic vs spatial vs blend predictors")
    pbo.add_argument("--appa", required=True)
    pbo.add_argument("--census-key", default=None)
    pbo.add_argument("--year", type=int, default=2022)
    pbo.add_argument("--k", type=int, default=10)
    pbo.set_defaults(func=cmd_bakeoff)

    pq = sub.add_parser("query", help="plain-language lookups against the scored dataset")
    pq.add_argument("--enriched", required=True)
    pq.add_argument("--distributions", required=True)
    pq.add_argument("--zip", default=None)
    pq.add_argument("--group-col", default="msa_title", dest="group_col")
    pq.add_argument("--group", default=None, help="market name to match (with --group-col)")
    pq.add_argument("--top-persona", default=None, dest="top_persona")
    pq.add_argument("--n", type=int, default=20)
    pq.set_defaults(func=cmd_query)

    pdl = sub.add_parser("deliverables", help="build workbook + maps + one-pagers from official outputs")
    pdl.add_argument("--enriched", required=True)
    pdl.add_argument("--distributions", required=True)
    pdl.add_argument("--outdir", default="deliverable_kit")
    pdl.add_argument("--preview", action="store_true")
    pdl.set_defaults(func=cmd_deliverables)

    pi = sub.add_parser("ingest-appa", help="convert APPA NPOS ZIP-by-segment xlsx -> tidy personas CSV")
    pi.add_argument("--input", required=True, help="the .xlsx workbook")
    pi.add_argument("--out", default="appa_personas.csv")
    pi.set_defaults(func=cmd_ingest_appa)

    pn = sub.add_parser("national", help="score all ZCTAs + coverage report")
    pn.add_argument("--demo", action="store_true")
    pn.add_argument("--personas", default=None)
    pn.add_argument("--features", default=None)
    pn.add_argument("--data-vintage", default=None, help="e.g. NPOS2024;ACS2022;HUD2023Q4")
    pn.add_argument("--out", default="enriched_national.csv")
    pn.add_argument("--calibrator", default=None, help="calibrator.json from `calibrate`")
    pn.add_argument("--shrink-alpha", type=float, default=5.0,
                    help="empirical-Bayes prior strength for thin ZIPs (0 disables)")
    pn.add_argument("--zip-dma", default=None, help="licensed ZIP->DMA crosswalk file (CSV/XLSX)")
    pn.add_argument("--market", choices=["msa", "dma"], default="msa", help="market geography for shrinkage")
    pn.add_argument("--k", type=int, default=10)
    pn.set_defaults(func=cmd_national)

    pc = sub.add_parser("coverage", help="coverage report from an enriched CSV")
    pc.add_argument("--input", required=True)
    pc.set_defaults(func=cmd_coverage)

    po = sub.add_parser("opportunity", help="rank ZIPs/MSAs by persona<->offer fit")
    po.add_argument("--enriched", required=True, help="enriched CSV from national/run/demo")
    po.add_argument("--targets", default=None, help="JSON file: {persona: weight}")
    po.add_argument("--targets-inline", default=None, help="inline JSON: '{\"Persona\": 1.0}'")
    po.add_argument("--sizes", default=None, help="CSV [zip, population] for addressable sizing")
    po.add_argument("--footprint", default=None, help="CSV [zip] of client's current locations")
    po.add_argument("--demo", action="store_true")
    po.add_argument("--out", default="opportunity_zips.csv")
    po.set_defaults(func=cmd_opportunity)

    pe = sub.add_parser("export", help="write a sellable file (resellable fields only) + manifest")
    pe.add_argument("--input", required=True, help="enriched CSV from run/demo")
    pe.add_argument("--out", default="deliverable.csv")
    pe.add_argument("--include-internal", action="store_true", help="INTERNAL USE ONLY: keep licensed fields")
    pe.set_defaults(func=cmd_export)

    pv = sub.add_parser("validate", help="cross-validated calibration report")
    pv.add_argument("--demo", action="store_true", help="validate on bundled synthetic data")
    pv.add_argument("--personas", default=None)
    pv.add_argument("--features", default=None)
    pv.add_argument("--k", type=int, default=10)
    pv.set_defaults(func=cmd_validate)

    pcal = sub.add_parser("calibrate", help="fit an isotonic confidence calibrator")
    pcal.add_argument("--demo", action="store_true")
    pcal.add_argument("--personas", default=None)
    pcal.add_argument("--features", default=None)
    pcal.add_argument("--k", type=int, default=10)
    pcal.add_argument("--out", default="calibrator.json")
    pcal.set_defaults(func=cmd_calibrate)

    pr = sub.add_parser("run", help="real run on your persona file")
    pr.add_argument("--personas", required=True)
    pr.add_argument("--features", default=None, help="ZIP feature CSV (default: cached ACS)")
    pr.add_argument("--out", default="enriched_zips.csv")
    pr.add_argument("--calibrator", default=None, help="calibrator.json from `calibrate`")
    pr.add_argument("--shrink-alpha", type=float, default=5.0,
                    help="empirical-Bayes prior strength for thin ZIPs (0 disables)")
    pr.add_argument("--zip-dma", default=None, help="licensed ZIP->DMA crosswalk file (CSV/XLSX)")
    pr.add_argument("--market", choices=["msa", "dma"], default="msa", help="market geography for shrinkage")
    pr.add_argument("--k", type=int, default=10)
    pr.set_defaults(func=cmd_run)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
