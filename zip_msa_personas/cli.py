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

from . import demo as demo_mod
from . import crosswalk, impute, personas, pipeline, rights, validation
from .data_sources import DataUnavailable, load_acs_zcta_features, load_reference_data


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


def cmd_validate(args) -> int:
    """Cross-validated calibration report -- run on demo or real data."""
    if args.demo:
        ref, features, persona_df = demo_mod.make_demo()
        dist = personas.aggregate_to_zip_distribution(
            personas.load_personas(_write_tmp(persona_df))
        )
    else:
        ref = load_reference_data()
        features = pd.read_csv(args.features, dtype={"zip": str}) if args.features else load_acs_zcta_features()
        features["zip"] = features["zip"].astype(str).str.zfill(5)
        dist = personas.aggregate_to_zip_distribution(personas.load_personas(args.personas))
    z2m = crosswalk.build_zip_to_msa(ref)
    z2m = z2m[z2m["zip"].isin(set(features["zip"]))]
    report = validation.backtest(features, dist, z2m, config=impute.ImputeConfig(k=args.k))
    print(report)
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
    out = pipeline.run_pipeline(args.personas, ref, features, config=impute.ImputeConfig(k=args.k))
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

    pr = sub.add_parser("run", help="real run on your persona file")
    pr.add_argument("--personas", required=True)
    pr.add_argument("--features", default=None, help="ZIP feature CSV (default: cached ACS)")
    pr.add_argument("--out", default="enriched_zips.csv")
    pr.add_argument("--k", type=int, default=10)
    pr.set_defaults(func=cmd_run)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
