"""Tests for the ZIP -> MSA -> persona pipeline.

Run: python -m pytest tests/  (or: python tests/test_pipeline.py)
"""
import pandas as pd

import numpy as np

from zip_msa_personas import (
    appa_loader, batch, calibration, crosswalk, demo, impute, opportunity,
    personas, pipeline, rights, shrinkage, validation,
)
from zip_msa_personas.data_sources import ReferenceData


def _demo_enriched(seed=2):
    import tempfile, os
    ref, features, persona_df = demo.make_demo(seed=seed)
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    persona_df.to_csv(path, index=False)
    out = pipeline.run_pipeline(path, ref, features)
    os.remove(path)
    return out.enriched, features


def test_dominant_assign_picks_highest_ratio():
    ref = ReferenceData(
        zip_cbsa=pd.DataFrame(
            [
                {"zip": "00001", "cbsa": "10000", "res_ratio": 0.7},
                {"zip": "00001", "cbsa": "20000", "res_ratio": 0.3},
            ]
        ),
        cbsa_meta=pd.DataFrame(
            [
                {"cbsa": "10000", "cbsa_title": "Metro A", "metro": True},
                {"cbsa": "20000", "cbsa_title": "Metro B", "metro": True},
            ]
        ),
    )
    z2m = crosswalk.build_zip_to_msa(ref)
    row = z2m[z2m["zip"] == "00001"].iloc[0]
    assert row["msa_cbsa"] == "10000"  # 0.7 > 0.3
    assert row["in_metro"]


def test_micropolitan_excluded_from_metro_assignment():
    ref = ReferenceData(
        zip_cbsa=pd.DataFrame([{"zip": "00002", "cbsa": "30000", "res_ratio": 1.0}]),
        cbsa_meta=pd.DataFrame([{"cbsa": "30000", "cbsa_title": "Micro X", "metro": False}]),
    )
    z2m = crosswalk.build_zip_to_msa(ref)
    row = z2m[z2m["zip"] == "00002"].iloc[0]
    assert not row["in_metro"]
    assert row["msa_cbsa"] is None


def test_persona_distribution_sums_to_one():
    raw = pd.DataFrame(
        [
            {"zip": "00003", "persona": "A", "weight": 3.0},
            {"zip": "00003", "persona": "B", "weight": 1.0},
        ]
    )
    dist = personas.aggregate_to_zip_distribution(raw)
    assert abs(dist[dist["zip"] == "00003"]["share"].sum() - 1.0) < 1e-9


def test_zip_column_autodetect():
    import tempfile, os
    df = pd.DataFrame({"Zip Code": ["07030"], "Segment": ["Urban Pros"]})
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    df.to_csv(path, index=False)
    loaded = personas.load_personas(path)
    assert loaded.iloc[0]["zip"] == "07030"
    assert loaded.iloc[0]["persona"] == "Urban Pros"
    os.remove(path)


def test_full_pipeline_labels_every_zip_with_three_tiers():
    ref, features, persona_df = demo.make_demo(seed=1)
    import tempfile, os
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    persona_df.to_csv(path, index=False)
    out = pipeline.run_pipeline(path, ref, features)
    os.remove(path)

    # Every feature-bearing ZIP gets exactly one labeled row.
    assert out.enriched["zip"].is_unique
    assert set(out.enriched["provenance"]) <= {
        impute.OBSERVED, impute.IMPUTED, impute.EXTRAPOLATED
    }
    # All three tiers should appear given the demo's design.
    assert {impute.OBSERVED, impute.IMPUTED, impute.EXTRAPOLATED} <= set(out.enriched["provenance"])
    # Confidence ordering: observed >= imputed-mean >= extrapolated-mean.
    means = out.enriched.groupby("provenance")["confidence"].mean()
    assert means[impute.OBSERVED] >= means[impute.IMPUTED] >= means[impute.EXTRAPOLATED]
    # Confidence is always a probability.
    assert out.enriched["confidence"].between(0, 1).all()


def test_output_carries_lineage_stamps():
    ref, features, persona_df = demo.make_demo(seed=3)
    import tempfile, os
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    persona_df.to_csv(path, index=False)
    out = pipeline.run_pipeline(path, ref, features, data_vintage="ACS2022;HUD2023Q4")
    os.remove(path)
    for col in ["methodology_version", "data_vintage", "model_params", "evidence"]:
        assert col in out.enriched.columns
    assert (out.enriched["data_vintage"] == "ACS2022;HUD2023Q4").all()
    # Imputed rows cite their look-alike neighbor ZIPs.
    imp = out.enriched[out.enriched["provenance"] == impute.IMPUTED]
    assert imp["evidence"].str.startswith("neighbors:").all()


def test_backtest_confidence_is_roughly_calibrated():
    ref, features, persona_df = demo.make_demo(seed=5)
    dist = personas.aggregate_to_zip_distribution(_df_to_dist(persona_df))
    z2m = crosswalk.build_zip_to_msa(ref)
    z2m = z2m[z2m["zip"].isin(set(features["zip"]))]
    report = validation.backtest(features, dist, z2m, n_splits=4)
    # Calibration error should be modest, and the disclosed tier should be the
    # least accurate of the tiers it produced.
    assert report.calibration_error < 0.25
    assert 0.0 <= report.overall_accuracy <= 1.0
    tiers = report.by_tier.set_index("provenance")["accuracy"].to_dict()
    if impute.EXTRAPOLATED in tiers and impute.IMPUTED in tiers:
        assert tiers[impute.EXTRAPOLATED] <= tiers[impute.IMPUTED] + 1e-9


def test_export_strips_licensed_fields_by_default():
    import tempfile, os
    df = pd.DataFrame(
        {
            "zip": ["07030"],
            "persona": ["Pet Enthusiasts"],
            "confidence": [0.8],
            "methodology_version": ["1.0.0"],
            "data_vintage": ["ACS2022"],
            "mosaic_group": ["G12"],  # licensed / internal-only
        }
    )
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    manifest = rights.export_deliverable(df, path)
    out = pd.read_csv(path)
    assert "mosaic_group" not in out.columns       # stripped by construction
    assert "persona" in out.columns                # first-party kept
    assert "mosaic_group" in manifest.excluded
    os.remove(path)
    os.remove(str(__import__("pathlib").Path(path).with_suffix(".manifest.json")))


def test_unknown_fields_fail_safe_to_internal():
    # Anything not in the registry is treated as non-resellable.
    assert rights.field_license("some_unregistered_column") == rights.INTERNAL
    assert rights.field_license("persona") == rights.RESELLABLE
    assert rights.field_license("mosaic_group") == rights.INTERNAL


def test_concordance_detects_alignment():
    # Perfect alignment -> high mutual information.
    a = pd.DataFrame({"zip": ["1", "2", "3", "4"], "persona": ["A", "A", "B", "B"]})
    ext = pd.DataFrame({"zip": ["1", "2", "3", "4"], "mosaic": ["X", "X", "Y", "Y"]})
    rep = validation.concordance(a, ext)
    assert rep.n_overlap == 4
    assert rep.normalized_mutual_info > 0.9
    assert rep.adjusted_rand > 0.9


def test_coverage_report_sums_to_total():
    enriched, _ = _demo_enriched()
    cov = batch.coverage_report(enriched)
    assert cov.total_zips == len(enriched)
    assert cov.by_provenance["zips"].sum() == cov.total_zips
    assert abs(cov.by_provenance["pct"].sum() - 1.0) < 1e-9
    # Per-MSA observed+estimated percentages are complementary.
    assert ((cov.by_msa["pct_observed"] + cov.by_msa["pct_estimated"] - 1.0).abs() < 1e-9).all()


def test_opportunity_scoring_ranks_and_discounts_estimates():
    enriched, features = _demo_enriched()
    targets = {"Affluent Empty-Nesters": 1.0, "Urban Professionals": 0.8}
    res = opportunity.score_opportunity(enriched, targets, sizes=features)
    # Weights normalized to sum 1.
    assert abs(sum(res.target_personas.values()) - 1.0) < 1e-9
    # Score is fit * confidence, so never exceeds fit.
    assert (res.zip_scores["opportunity_score"] <= res.zip_scores["fit"] + 1e-9).all()
    # A non-target persona contributes zero fit.
    non_target = res.zip_scores[~res.zip_scores["persona"].isin(targets)]
    if not non_target.empty:
        assert (non_target["fit"] == 0).all()
    # MSAs ranked by addressable, descending.
    add = res.msa_scores["total_addressable"].tolist()
    assert add == sorted(add, reverse=True)


def test_opportunity_whitespace_excludes_footprint():
    enriched, features = _demo_enriched()
    targets = {"Urban Professionals": 1.0}
    # Put every Urban Professional ZIP in the footprint -> no whitespace.
    up_zips = enriched[enriched["persona"] == "Urban Professionals"]["zip"].tolist()
    res = opportunity.score_opportunity(enriched, targets, sizes=features, footprint_zips=up_zips)
    assert res.zip_scores["whitespace"].sum() == 0


def _miscalibrated_predictions(n=400, seed=0):
    # Model claims high confidence (~0.75 avg) but is right only ~50% -- badly
    # miscalibrated, so a working calibrator must reduce ECE substantially.
    rng = np.random.default_rng(seed)
    conf = rng.uniform(0.5, 1.0, n)
    correct = (rng.random(n) < 0.5).astype(int)
    return pd.DataFrame(
        {
            "zip": [str(i).zfill(5) for i in range(n)],
            "confidence": conf,
            "correct": correct,
            "provenance": impute.IMPUTED,
        }
    )


def test_calibration_reduces_ece_on_miscalibrated_data():
    preds = _miscalibrated_predictions()
    cal = calibration.fit_calibrator(preds)
    before = calibration.expected_calibration_error(preds["confidence"], preds["correct"])
    after = calibration.expected_calibration_error(cal.transform(preds["confidence"]), preds["correct"])
    assert after < before
    assert after < 0.1   # near-perfectly calibrated to the ~0.5 base rate


def test_calibrator_is_monotonic_bounded_and_roundtrips():
    preds = _miscalibrated_predictions(seed=1)
    cal = calibration.fit_calibrator(preds)
    grid = np.linspace(0, 1, 50)
    out = cal.transform(grid)
    assert (out >= 0).all() and (out <= 1).all()
    assert (np.diff(out) >= -1e-9).all()           # non-decreasing
    reloaded = calibration.Calibrator.from_json(cal.to_json())
    assert np.allclose(reloaded.transform(grid), out)


def test_apply_calibration_preserves_observed_and_adds_raw():
    enriched, _ = _demo_enriched()
    cal = calibration.fit_calibrator(_miscalibrated_predictions(seed=2))
    out = calibration.apply_calibration(enriched, cal)
    assert "confidence_raw" in out.columns
    obs = out[out["provenance"] == impute.OBSERVED]
    assert (obs["confidence"] == obs["confidence_raw"]).all()   # ground truth untouched


def test_build_workbook_has_expected_tabs():
    import tempfile, os, openpyxl
    from zip_msa_personas import reporting
    segs = ["Seg A", "Seg B"]
    z = pd.DataFrame(
        {
            "ZIP": ["00001", "00002", "00003"],
            "City": ["X", "Y", "Z"],
            "State": ["AA", "AA", "BB"],
            "Top persona": ["Seg A", "Seg B", "Seg A"],
            "Confidence": [0.9, 0.5, 0.2],
            "Basis": [reporting.BASIS_ORDER[0], reporting.BASIS_ORDER[1], reporting.BASIS_ORDER[2]],
            "Seg A": [0.7, 0.3, 0.6],
            "Seg B": [0.3, 0.7, 0.4],
        }
    )
    fd, path = tempfile.mkstemp(suffix=".xlsx"); os.close(fd)
    reporting.build_workbook(z, segs, path, top_n=2)
    wb = openpyxl.load_workbook(path, read_only=True)
    names = wb.sheetnames
    os.remove(path)
    assert {"Read me", "All ZIPs", "By State", "Footprint by basis"} <= set(names)
    assert any(n.startswith("Top2 Seg A") for n in names)


def test_impute_returns_full_distributions_that_sum_to_one():
    ref, features, persona_df = demo.make_demo(seed=6)
    dist = personas.aggregate_to_zip_distribution(_df_to_dist(persona_df))
    z2m = crosswalk.build_zip_to_msa(ref)
    z2m = z2m[z2m["zip"].isin(set(features["zip"]))]
    res = impute.impute_personas(features, dist, z2m, return_distributions=True)
    assert res.distributions is not None
    # Every scored ZIP has a distribution that sums to ~1.
    sums = res.distributions.groupby("zip")["share"].sum()
    assert (abs(sums - 1.0) < 1e-3).all()   # shares stored rounded to 5 dp
    # The top persona in the distribution matches the assignment's persona.
    top = res.distributions.sort_values("share").groupby("zip").tail(1).set_index("zip")["persona"]
    a = res.assignments.set_index("zip")["persona"]
    agree = (top.reindex(a.index) == a).mean()
    assert agree > 0.99


def test_shrinkage_pulls_thin_zips_to_prior_and_lowers_confidence():
    # One thin ZIP (1 respondent, segment A) and one dense ZIP (mostly B).
    # National prior is B-heavy, so the thin ZIP should be pulled toward B and
    # carry much lower confidence than the dense one.
    dist = pd.DataFrame(
        [
            {"zip": "00001", "persona": "A", "weight": 1.0},
            {"zip": "00002", "persona": "B", "weight": 40.0},
            {"zip": "00002", "persona": "A", "weight": 2.0},
            {"zip": "00003", "persona": "B", "weight": 30.0},
        ]
    )
    sr = shrinkage.shrink(dist, alpha=5.0)
    d = sr.distribution.set_index(["zip", "persona"])["share"]
    # Thin ZIP's A share is dragged well below its raw 1.0.
    assert d[("00001", "A")] < 0.6
    # Confidence: dense ZIP > thin ZIP.
    assert sr.confidence["00002"] > sr.confidence["00001"]
    # Shares sum to 1 per zip.
    tot = sr.distribution.groupby("zip")["share"].sum()
    assert (abs(tot - 1.0) < 1e-9).all()


def test_shrinkage_respects_market_prior():
    # Two markets with opposite compositions; a thin ZIP shrinks toward ITS market.
    dist = pd.DataFrame(
        [
            {"zip": "10001", "persona": "X", "weight": 50.0},   # market M1 -> X-heavy
            {"zip": "10002", "persona": "Y", "weight": 1.0},    # thin, in M1
            {"zip": "20001", "persona": "Y", "weight": 50.0},   # market M2 -> Y-heavy
        ]
    )
    market_map = {"10001": "M1", "10002": "M1", "20001": "M2"}
    sr = shrinkage.shrink(dist, alpha=10.0, market_map=market_map)
    d = sr.distribution.set_index(["zip", "persona"])["share"]
    # Thin ZIP in M1 should gain X mass from its X-heavy market despite observing Y.
    assert d.get(("10002", "X"), 0) > 0.4


def test_zip_dma_loader_normalizes_and_dedupes():
    import tempfile, os
    from zip_msa_personas import data_sources
    df = pd.DataFrame(
        {
            "Zip Code": ["7030", "07030", "10001"],   # 4-digit + dup of same zip
            "DMA": ["501", "501", "803"],
            "Market Name": ["New York", "New York", "Los Angeles"],
        }
    )
    fd, path = tempfile.mkstemp(suffix=".csv"); os.close(fd)
    df.to_csv(path, index=False)
    loaded = data_sources.load_zip_dma_crosswalk(path)
    os.remove(path)
    assert list(loaded.columns) == ["zip", "dma_code", "dma_name"]
    assert set(loaded["zip"]) == {"07030", "10001"}        # zfill applied
    z2d = crosswalk.build_zip_to_dma(loaded)
    assert z2d["zip"].is_unique                            # one DMA per zip
    assert z2d[z2d["zip"] == "07030"]["dma_code"].iloc[0] == "501"


def test_dma_used_as_shrinkage_market():
    # A thin ZIP shrinks toward its DMA's composition, not the national one.
    ref, features, persona_df = demo.make_demo(seed=4)
    import tempfile, os
    fd, p = tempfile.mkstemp(suffix=".csv"); os.close(fd)
    persona_df.to_csv(p, index=False)
    z2d = pd.DataFrame({"zip": features["zip"], "dma_code": "501", "dma_name": "New York"})
    out = pipeline.run_pipeline(p, ref, features, shrink_alpha=5.0, zip_to_dma=z2d, market="dma")
    os.remove(p)
    assert {"dma_code", "dma_name"} <= set(out.enriched.columns)
    assert out.enriched["dma_code"].notna().any()


def test_dma_fields_are_rights_tagged():
    assert rights.field_license("dma_code") == rights.RESELLABLE
    assert rights.FIELD_SOURCE["dma_code"] == "nielsen_dma"


def test_appa_dma_sheet_parses():
    import tempfile, os
    seg_cols = {name: 2 + 2 * i for i, name in enumerate(appa_loader.SEGMENTS)}  # DMA: segs start col 2
    ncols = 16
    grid = [["" for _ in range(ncols)] for _ in range(6)]
    for name, c in seg_cols.items():
        grid[3][c] = name
        grid[4][c] = "Count"; grid[4][c + 1] = "%"
    grid[5][1] = "Weighted base"
    row = ["" for _ in range(ncols)]
    row[1] = "501 - NEW YORK"; row[seg_cols["Comfort Companions"]] = 12.0
    grid.append(row)
    fd, path = tempfile.mkstemp(suffix=".xlsx"); os.close(fd)
    pd.DataFrame(grid).to_excel(path, sheet_name="DMA", header=False, index=False)
    dma = appa_loader.load_appa_dma(path)
    os.remove(path)
    assert dma["dma"].tolist() == ["501 - NEW YORK"]
    assert abs(dma["weight"].iloc[0] - 12.0) < 1e-9


def test_appa_loader_parses_weighted_matrix():
    import tempfile, os
    from zip_msa_personas import appa_loader
    seg_cols = {name: 3 + 2 * i for i, name in enumerate(appa_loader.SEGMENTS)}
    ncols = 17
    grid = [["" for _ in range(ncols)] for _ in range(6)]
    grid[3][0] = "Sheet 1"
    for name, c in seg_cols.items():
        grid[3][c] = name            # segment-name header row
        grid[4][c] = "Count"
        grid[4][c + 1] = "%"
    grid[5][2] = "Weighted base"     # base row (no valid zip -> skipped)

    def datarow(state, zipv, weights):
        row = ["" for _ in range(ncols)]
        row[1] = state
        row[2] = zipv
        for name, w in weights.items():
            row[seg_cols[name]] = w
        return row

    grid.append(datarow("MASSACHUSETTS", "1001", {"Comfort Companions": 2.0}))   # 4-digit -> zfill
    grid.append(datarow("", "10002", {"Adventure Seekers": 1.5, "Well-being Warriors": 0.5}))
    grid.append(datarow("", "10003", {}))                                        # all-zero -> dropped
    sumrow = ["" for _ in range(ncols)]; sumrow[2] = "SUM"
    grid.append(sumrow)

    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    pd.DataFrame(grid).to_excel(path, sheet_name="ZIPS BY STATE", header=False, index=False)

    long = appa_loader.load_appa_segmentation(path)
    os.remove(path)
    assert set(long["zip"]) == {"01001", "10002"}            # zfill + all-zero dropped + SUM dropped
    comfort = long[(long["zip"] == "01001") & (long["persona"] == "Comfort Companions")]
    assert abs(comfort["weight"].iloc[0] - 2.0) < 1e-9
    assert long[long["zip"] == "10002"].shape[0] == 2        # two segments present


def _df_to_dist(persona_df):
    import pandas as pd
    raw = pd.DataFrame(
        {
            "zip": persona_df["zip"].astype(str).str.zfill(5),
            "persona": persona_df["persona"],
            "weight": persona_df.get("count", 1.0),
        }
    )
    return raw


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"PASS {name}")
    print("All tests passed.")
