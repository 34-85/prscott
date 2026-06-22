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


def test_acs_buckets_cover_propensity_categories():
    from zip_msa_personas import acs, propensity as pr
    for var, cats in pr.ACS_CATEGORY_SPEC.items():
        assert set(acs.ACS_BUCKETS[var].keys()) == set(cats)


def test_acs_fractions_roll_up_and_normalize():
    from zip_msa_personas import acs
    counts = pd.DataFrame(
        {
            # age: mostly young adults
            "22_24": [100.0], "25_29": [100.0], "55_59": [50.0],
            # income: split low/high
            "lt_10k": [40.0], "200k_plus": [60.0],
            # race
            "white": [70.0], "hispanic": [30.0],
            # marital
            "now_married": [60.0], "never_married": [40.0],
        },
        index=["00001"],
    )
    f = acs.fractions_from_counts(counts)
    # Each variable's category fractions sum to 1.
    for var in ("age", "income", "race", "marital"):
        cols = [c for c in f.columns if c.startswith(var + "_")]
        assert abs(f[cols].sum(axis=1).iloc[0] - 1.0) < 1e-9
    # 55_59 rolls into Gen X; the rest of the age mass is Gen Z / Millennial.
    assert f.loc["00001", "age_genx"] == 0.2
    # Income split: 40 low / 60 high.
    assert abs(f.loc["00001", "income_low"] - 0.4) < 1e-9
    assert abs(f.loc["00001", "income_high"] - 0.6) < 1e-9
    # Marital: widowed/divorced/separated absent -> formerly_married = 0.
    assert f.loc["00001", "marital_formerly_married"] == 0.0


def test_acs_fractions_feed_propensity_end_to_end():
    from zip_msa_personas import acs, propensity as pr
    counts = pd.DataFrame(
        {"25_29": [200.0], "200k_plus": [150.0], "asian": [120.0], "hispanic": [80.0],
         "never_married": [180.0]},
        index=["29000"],
    )
    mix = pr.score_demographics(acs.fractions_from_counts(counts))
    assert abs(mix.iloc[0].sum() - 1.0) < 1e-9
    # Young, affluent, diverse, never-married -> Security Seekers tops the mix.
    assert mix.iloc[0].idxmax() == "Security Seekers"


def test_zcta_cbsa_reference_builds_crosswalk():
    import tempfile, os
    from zip_msa_personas import data_sources as ds
    # ZCTA -> county relationship rows (Census format), joined to an injected
    # county -> CBSA delineation. 10001 spans two counties in different CBSAs;
    # dominant assignment by land area picks 35620. 59722 -> a Micro CBSA.
    rel = pd.DataFrame([
        {"GEOID_ZCTA5_20": "10001", "GEOID_COUNTY_20": "36061", "AREALAND_PART": "900"},
        {"GEOID_ZCTA5_20": "10001", "GEOID_COUNTY_20": "36005", "AREALAND_PART": "100"},
        {"GEOID_ZCTA5_20": "59722", "GEOID_COUNTY_20": "30077", "AREALAND_PART": "300"},
        {"GEOID_ZCTA5_20": "99999", "GEOID_COUNTY_20": "99999", "AREALAND_PART": "0"},
    ])
    delin = pd.DataFrame([
        {"county": "36061", "cbsa": "35620", "cbsa_title": "New York-Newark-Jersey City, NY-NJ", "metro": True},
        {"county": "36005", "cbsa": "35620", "cbsa_title": "New York-Newark-Jersey City, NY-NJ", "metro": True},
        {"county": "30077", "cbsa": "14580", "cbsa_title": "Deer Lodge, MT", "metro": False},
    ])
    fd, p = tempfile.mkstemp(suffix=".txt"); os.close(fd)
    rel.to_csv(p, sep="|", index=False)
    ref = ds.load_zcta_cbsa_reference(p, delineation=delin)
    z2m = crosswalk.build_zip_to_msa(ref)
    os.remove(p)
    # Dominant assignment by land area; micro excluded from metro; ZIP w/o CBSA dropped.
    assert z2m[z2m.zip == "10001"]["msa_cbsa"].iloc[0] == "35620"
    assert not bool(z2m[z2m.zip == "59722"]["in_metro"].iloc[0])
    assert z2m[z2m.zip == "10001"]["msa_title"].iloc[0] == "New York-Newark-Jersey City, NY-NJ"
    assert "99999" not in set(z2m.zip)


def test_spatial_predictor_and_bakeoff():
    import numpy as np
    from zip_msa_personas import spatial
    personas = ["A", "B", "C"]
    rng = np.random.default_rng(0)
    zips = [f"{i:05d}" for i in range(120)]
    coords = pd.DataFrame({"lat": rng.uniform(25, 48, 120), "lon": rng.uniform(-122, -71, 120)}, index=zips)

    def mix_for(lon):
        t = (lon + 122) / 51
        m = np.clip(np.array([1 - t, 0.5, t]), 0.05, None)
        return m / m.sum()
    sw = pd.DataFrame([mix_for(coords.loc[z, "lon"]) for z in zips], index=zips, columns=personas)
    pred = spatial.spatial_loo_predict(sw, coords, k=8)
    # Leave-one-out spatial prediction recovers the smooth structure.
    assert np.corrcoef(pred["A"], sw["A"])[0, 1] > 0.8
    # Blend stays a valid distribution.
    dm = pd.DataFrame(rng.dirichlet([1, 1, 1], size=120), index=zips, columns=personas)
    bl = spatial.blend_mixes(pred, dm)
    assert (abs(bl.sum(axis=1) - 1.0) < 1e-9).all()


def test_spatial_predict_production_and_blend_full():
    import numpy as np
    from zip_msa_personas import spatial
    personas = ["A", "B", "C"]
    rng = np.random.default_rng(0)
    s_zips = [f"{i:05d}" for i in range(50)]
    scoords = pd.DataFrame({"lat": rng.uniform(25, 48, 50), "lon": rng.uniform(-122, -71, 50)}, index=s_zips)

    def mix(lon):
        t = (lon + 122) / 51
        m = np.clip(np.array([1 - t, 0.5, t]), 0.05, None)
        return m / m.sum()
    sw = pd.DataFrame([mix(scoords.loc[z, "lon"]) for z in s_zips], index=s_zips, columns=personas)
    t_zips = [f"9{i:04d}" for i in range(100)]
    tc = pd.DataFrame({"lat": rng.uniform(25, 48, 100), "lon": rng.uniform(-122, -71, 100)}, index=t_zips)
    pred = spatial.spatial_predict(sw, scoords, tc, k=8)
    assert len(pred) == 100 and (abs(pred.sum(axis=1) - 1.0) < 1e-9).all()
    assert pred[tc["lon"] < -100]["A"].mean() > pred[tc["lon"] > -85]["A"].mean()  # west leans A
    # blend_full unions coverage and keeps valid distributions.
    dm = pd.DataFrame(rng.dirichlet([1, 1, 1], size=100), index=t_zips, columns=personas)
    bl = spatial.blend_full(pred, dm)
    assert (abs(bl.sum(axis=1) - 1.0) < 1e-9).all()


def test_vetsiting_scores_service_model_lean():
    from zip_msa_personas import vetsiting
    enr = pd.DataFrame({"zip": ["10001", "10002", "20001", "20002"],
                        "msa_title": ["A", "A", "B", "B"]})
    rows = []
    for z, m in [("10001", {"Well-being Warriors": 0.6, "Ambitious Go-Getters": 0.4}),
                 ("10002", {"Well-being Warriors": 0.7, "Security Seekers": 0.3}),
                 ("20001", {"Prudent Pragmatists": 0.5, "Adventure Seekers": 0.5}),
                 ("20002", {"Adventure Seekers": 0.6, "Prudent Pragmatists": 0.4})]:
        rows += [{"zip": z, "persona": p, "share": s} for p, s in m.items()]
    sc = vetsiting.score_msas(enr, pd.DataFrame(rows), min_zips=1)
    # Health/affluent MSA leans hospital; budget/outdoor MSA leans urgent care.
    assert sc.loc["A", "hospital_fit"] > sc.loc["A", "urgentcare_fit"]
    assert sc.loc["B", "urgentcare_fit"] > sc.loc["B", "hospital_fit"]


def test_vetsiting_volume_gate_and_recommendation():
    from zip_msa_personas import vetsiting
    enr = pd.DataFrame({"zip": ["10001", "10002", "20001", "20002", "30001", "30002"],
                        "msa_title": ["Hosp", "Hosp", "Urg", "Urg", "Tiny", "Tiny"]})
    rows = []
    for z, m in [("10001", {"Well-being Warriors": 0.7, "Ambitious Go-Getters": 0.3}),
                 ("10002", {"Well-being Warriors": 0.6, "Security Seekers": 0.4}),
                 ("20001", {"Prudent Pragmatists": 0.5, "Adventure Seekers": 0.5}),
                 ("20002", {"Adventure Seekers": 0.6, "Prudent Pragmatists": 0.4}),
                 ("30001", {"Comfort Companions": 0.5, "Adventure Seekers": 0.5}),
                 ("30002", {"Comfort Companions": 0.6, "Prudent Pragmatists": 0.4})]:
        rows += [{"zip": z, "persona": p, "share": s} for p, s in m.items()]
    sc = vetsiting.score_msas(enr, pd.DataFrame(rows), min_zips=1)
    feats = pd.DataFrame({"zip": ["10001", "10002", "20001", "20002", "30001", "30002"],
                          "households": [50000, 60000, 40000, 45000, 1000, 1200],
                          "median_household_income": [95000, 90000, 55000, 52000, 48000, 50000]})
    sc = sc.join(vetsiting.build_volume_from_acs(enr, feats, ownership_rate=0.66))
    out = vetsiting.recommend_sites(sc, avoid_quantile=0.25)
    rec = out["recommendation"].to_dict()
    assert rec["Hosp"] == "Build hospital"
    assert rec["Urg"] == "Build urgent care"
    assert rec["Tiny"] == "Avoid (low volume)"
    assert abs(out.loc["Hosp", "addressable_pet_hh"] - (110000 * 0.66)) < 1


def test_query_lookups():
    from zip_msa_personas import query
    enr = pd.DataFrame({
        "zip": ["10001", "30301"],
        "persona": ["Security Seekers", "Comfort Companions"],
        "confidence": [0.31, 0.22],
        "provenance": ["survey_anchored", "demographic_model"],
        "msa_title": ["New York-Newark", "Atlanta"],
    })
    dist = pd.DataFrame([
        {"zip": "10001", "persona": "Security Seekers", "share": 0.4},
        {"zip": "10001", "persona": "Adventure Seekers", "share": 0.6},
        {"zip": "30301", "persona": "Comfort Companions", "share": 0.7},
        {"zip": "30301", "persona": "Adventure Seekers", "share": 0.3},
    ])
    mix = query.mix_for_zip(dist, "10001")
    assert mix.index[0] == "Adventure Seekers" and abs(mix.iloc[0] - 60.0) < 1e-6
    tm = query.top_markets_for_persona(enr, dist, "Security Seekers", "msa_title", n=5)
    assert tm.iloc[0]["msa_title"] == "New York-Newark"
    assert "Security Seekers" in query.siting_read(enr, dist, "10001")


def test_census_region_map_and_zcta_state():
    import tempfile, os
    from zip_msa_personas import validation as v, data_sources as ds
    rm = v.census_region_map(pd.DataFrame({"zip": ["10001", "90001", "60601", "30301"],
                                           "state": ["36", "06", "17", "13"]}))
    assert rm == {"10001": "Northeast", "90001": "West", "60601": "Midwest", "30301": "South"}
    # zip -> state from a synthetic ZCTA->county relationship file.
    rows = pd.DataFrame([
        {"GEOID_ZCTA5_20": "10001", "GEOID_COUNTY_20": "36061", "AREALAND_PART": "900"},
        {"GEOID_ZCTA5_20": "10001", "GEOID_COUNTY_20": "34017", "AREALAND_PART": "100"},
    ])
    fd, p = tempfile.mkstemp(suffix=".txt"); os.close(fd)
    rows.to_csv(p, sep="|", index=False)
    z2s = ds.load_zcta_state(p)
    os.remove(p)
    assert z2s[z2s.zip == "10001"]["state"].iloc[0] == "36"   # dominant county is NY (36)


def test_directional_agreement_beats_chance():
    import numpy as np
    from zip_msa_personas import validation as v
    personas = ["A", "B", "C"]
    natl = np.array([0.5, 0.3, 0.2])
    rng = np.random.default_rng(1)
    rows, model = [], {}
    for i in range(40):
        skew = rng.normal(0, 0.15, 3)
        s = np.clip(natl + skew, 0.01, None); s = s / s.sum()
        m = np.clip(natl + skew * 0.6, 0.01, None); m = m / m.sum()  # same direction
        model[f"G{i}"] = m
        for p, share in zip(personas, s):
            for j in range(20):
                rows.append({"zip": f"{i:02d}{j:03d}", "persona": p, "weight": share * 10})
    surv = pd.DataFrame(rows)
    gmap = {f"{i:02d}{j:03d}": f"G{i}" for i in range(40) for j in range(20)}
    zl = list(dict.fromkeys(surv["zip"]))
    mm = pd.DataFrame([model[gmap[z]] for z in zl], index=zl, columns=personas)
    rep = v.validate_model_vs_survey(mm, surv, group_map=gmap, min_n=30)
    assert rep.directional_agreement > rep.directional_chance + 0.1


def test_validate_model_vs_survey_detects_agreement():
    import numpy as np
    from zip_msa_personas import validation as v
    personas = ["A", "B", "C"]
    zips = [f"{i:05d}" for i in range(60)]
    gmap = {z: f"G{i % 3}" for i, z in enumerate(zips)}
    truth = {"G0": [0.6, 0.3, 0.1], "G1": [0.2, 0.6, 0.2], "G2": [0.2, 0.2, 0.6]}
    mm = pd.DataFrame([truth[gmap[z]] for z in zips], index=zips, columns=personas)
    surv = pd.DataFrame(
        [{"zip": z, "persona": p, "weight": s * 50} for z in zips for p, s in zip(personas, truth[gmap[z]])]
    )
    rep = v.validate_model_vs_survey(mm, surv, group_map=gmap, min_n=30)
    assert rep.top1_agreement == 1.0
    assert rep.mean_abs_error < 0.05


def test_national_calibration_matches_target_mix():
    import numpy as np
    from zip_msa_personas import propensity as pr
    rng = np.random.default_rng(0)
    personas = ["A", "B", "C", "D"]
    mix = pd.DataFrame(rng.dirichlet([0.55, 0.2, 0.15, 0.10] * np.array(6), size=1500), columns=personas)
    target = {"A": 0.25, "B": 0.25, "C": 0.25, "D": 0.25}
    factors = pr.fit_national_calibration(mix, target)
    cal = pr.apply_national_calibration(mix, factors)
    nm = pr.national_mix(cal)
    # National weighted mix now matches the target within tolerance.
    for p in personas:
        assert abs(nm[p] - 0.25) < 1e-3
    # Each ZIP's mix still sums to 1.
    assert (abs(cal.sum(axis=1) - 1.0) < 1e-9).all()


def test_propensity_fingerprints_load():
    from zip_msa_personas import propensity as pr
    fp = pr.load_fingerprints()
    assert len(fp.personas) == 7
    assert abs(sum(fp.base_rates.values()) - 1.0) < 1e-6
    for p in fp.personas:
        for v in ("age", "income", "race", "marital"):
            assert v in fp.fingerprints[p]


def _archetype(age, inc, race, mar):
    from zip_msa_personas import propensity as pr
    d = {}
    for v, cat in [("age", age), ("income", inc), ("race", race), ("marital", mar)]:
        for c in pr.ACS_CATEGORY_SPEC[v]:
            d[f"{v}_{c}"] = 1.0 if c == cat else 0.0
    return d


def test_propensity_matches_deck_signatures():
    from zip_msa_personas import propensity as pr
    fp = pr.load_fingerprints()
    arch = pd.DataFrame(
        {
            "young_affluent_diverse": _archetype("genz", "high", "asian", "never_married"),
            "older_white_lowincome": _archetype("boomer", "low", "white", "formerly_married"),
        }
    ).T
    mix = pr.score_demographics(arch, fp)
    # mix sums to 1 per ZIP
    assert (abs(mix.sum(axis=1) - 1.0) < 1e-9).all()
    # young/affluent/diverse over-indexes Security Seekers above its base rate
    assert mix.loc["young_affluent_diverse", "Security Seekers"] > fp.base_rates["Security Seekers"]
    assert pr.dominant(mix).loc["young_affluent_diverse", "persona"] == "Security Seekers"
    # older/white/low-income leans Comfort Companions
    assert pr.dominant(mix).loc["older_white_lowincome", "persona"] == "Comfort Companions"


def test_propensity_national_index_is_100_at_base_rate():
    from zip_msa_personas import propensity as pr
    fp = pr.load_fingerprints()
    mix = pd.DataFrame([fp.base_rates])  # one "ZIP" exactly at national mix
    idx = pr.national_index(mix, fp.base_rates)
    assert (abs(idx.iloc[0] - 100) <= 1).all()


def test_demographic_blend_without_hud_and_coverage():
    # Official demographics-only path: ref=None (HUD unavailable), blend tiers.
    ref, features, persona_df = demo.make_demo(seed=11)
    allz = sorted(features["zip"]); segs = sorted(persona_df["persona"].unique())
    mix = pd.DataFrame(1.0 / len(segs), index=allz, columns=segs)
    import tempfile, os
    fd, p = tempfile.mkstemp(suffix=".csv"); os.close(fd)
    persona_df.to_csv(p, index=False)
    out = pipeline.run_demographic_blend(p, None, mix, data_vintage="ACS2022")
    os.remove(p)
    from zip_msa_personas import propensity as pr
    assert out.enriched["msa_cbsa"].isna().all()            # no HUD -> blank MSA labels
    assert set(out.enriched["provenance"]) <= {pr.SURVEY_ANCHORED, pr.DEMOGRAPHIC_MODEL}
    # Coverage report is provenance-agnostic and totals correctly.
    cov = batch.coverage_report(out.enriched)
    assert cov.by_provenance["zips"].sum() == len(out.enriched)
    assert cov.by_msa.empty                                 # no MSA labels available


def test_blend_with_survey_covers_all_and_survey_overrides():
    from zip_msa_personas import propensity as pr
    survey = pd.DataFrame([("A", "X", 100.0), ("B", "Y", 2.0)], columns=["zip", "persona", "weight"])
    demo = pd.DataFrame({"X": [0.2, 0.3, 0.9], "Y": [0.8, 0.7, 0.1]}, index=["A", "B", "C"])
    a, d = pr.blend_with_survey(survey, demo, alpha=5.0)
    a = a.set_index("zip")
    # Strong survey overrides the prior; A flips from prior-Y to survey-X.
    assert a.loc["A", "persona"] == "X" and a.loc["A", "provenance"] == pr.SURVEY_ANCHORED
    # No-survey ZIP gets the demographic prior, full coverage, no extrapolation tail.
    assert a.loc["C", "provenance"] == pr.DEMOGRAPHIC_MODEL and a.loc["C", "persona"] == "X"
    assert set(a.index) == {"A", "B", "C"}
    assert (abs(d.groupby("zip")["share"].sum() - 1.0) < 1e-6).all()


def test_run_demographic_blend_scores_every_demographic_zip():
    ref, features, persona_df = demo.make_demo(seed=8)
    surv_personas = sorted(persona_df["persona"].unique())
    # A demographic prior covering ALL feature ZIPs (superset of surveyed ones).
    allz = sorted(features["zip"])
    mix = pd.DataFrame(
        1.0 / len(surv_personas), index=allz, columns=surv_personas
    )
    import tempfile, os
    fd, p = tempfile.mkstemp(suffix=".csv"); os.close(fd)
    persona_df.to_csv(p, index=False)
    out = pipeline.run_demographic_blend(p, ref, mix, data_vintage="NPOS2025;ACS2022")
    os.remove(p)
    from zip_msa_personas import propensity as pr
    assert set(out.enriched["zip"]) == set(allz)                 # every demographic ZIP scored
    assert set(out.enriched["provenance"]) <= {pr.SURVEY_ANCHORED, pr.DEMOGRAPHIC_MODEL}
    assert {"msa_cbsa", "methodology_version", "data_vintage"} <= set(out.enriched.columns)
    # ZIPs with survey are anchored; the rest are demographic_model.
    surveyed = set(persona_df["zip"].astype(str).str.zfill(5))
    anchored = set(out.enriched[out.enriched["provenance"] == pr.SURVEY_ANCHORED]["zip"])
    assert anchored <= surveyed


def test_indexing_gates_significance_on_sample_size():
    from zip_msa_personas import indexing
    shares = pd.DataFrame({"X": [1.0, 0.5], "Y": [0.0, 0.5]}, index=["thin", "solid"])
    base = {"X": 0.1, "Y": 0.9}
    n = pd.Series({"thin": 1.0, "solid": 200.0})
    t = indexing.index_with_significance(shares, base, n, min_n=30).set_index(["geo", "persona"])
    # A single-respondent 100% cell must NOT be called significant.
    assert not t.loc[("thin", "X"), "significant"]
    # A large-sample clear over-index IS significant.
    assert t.loc[("solid", "X"), "significant"] and t.loc[("solid", "X"), "direction"] == "over"
    assert t.loc[("solid", "X"), "index"] == 500


def test_lookalike_excludes_seeds_and_ranks_by_similarity():
    from zip_msa_personas import lookalike
    profiles = pd.DataFrame(
        {"X": [0.9, 0.85, 0.1, 0.88], "Y": [0.1, 0.15, 0.9, 0.12]},
        index=["seed", "similar", "different", "similar2"],
    )
    res = lookalike.find_lookalikes(profiles, ["seed"], top_n=3)
    assert "seed" not in set(res["geo"])                 # seeds excluded
    assert res.iloc[0]["geo"] in {"similar", "similar2"}  # closest profile ranks first
    assert res["similarity"].is_monotonic_decreasing
    assert res.iloc[-1]["geo"] == "different"


def test_onepager_renders():
    import tempfile, os
    from zip_msa_personas import onepager, propensity
    fp = propensity.load_fingerprints()
    desc = onepager.load_descriptions(propensity.DEFAULT_FINGERPRINTS.parent / "persona_descriptions.json")
    fd, path = tempfile.mkstemp(suffix=".png"); os.close(fd)
    out = onepager.build_persona_onepager("Security Seekers", fp, desc, None, None, path)
    assert out.exists() and out.stat().st_size > 0
    os.remove(path)


def test_maps_render_png_files():
    import tempfile, os
    from zip_msa_personas import maps
    df = pd.DataFrame(
        {
            "lon": [-100, -80, -120, -90],
            "lat": [40, 35, 45, 30],
            "Top persona": ["A", "B", "A", "B"],
            "A_idx": [150, 50, 120, 80],
        }
    )
    d = tempfile.mkdtemp()
    p1 = maps.dominant_persona_map(df, "Top persona", os.path.join(d, "dom.png"))
    p2 = maps.index_map(df, "A_idx", os.path.join(d, "idx.png"), title="A index")
    assert p1.exists() and p1.stat().st_size > 0
    assert p2.exists() and p2.stat().st_size > 0
    os.remove(p1); os.remove(p2); os.rmdir(d)


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
