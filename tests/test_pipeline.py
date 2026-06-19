"""Tests for the ZIP -> MSA -> persona pipeline.

Run: python -m pytest tests/  (or: python tests/test_pipeline.py)
"""
import pandas as pd

from zip_msa_personas import crosswalk, demo, impute, personas, pipeline
from zip_msa_personas.data_sources import ReferenceData


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


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"PASS {name}")
    print("All tests passed.")
