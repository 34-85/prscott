"""Vet-siting persona-demand layer: which service model each metro's pet-owner
mix favors -- full-service hospital vs urgent care.

Scores every MSA by how well its persona mix fits each service model, using the
persona->model weights derived from the APPA deck's spend/attitude signals.
This is the demand-*quality* layer; the enter/avoid *volume* gate (addressable
pet households, competition) is layered on separately.
"""
from __future__ import annotations

import pandas as pd

# Persona -> service-model affinity (0..1), from the deck's spend/attitude signals.
# Hospital favors preventive, higher-spend, pet-as-family segments; urgent care
# favors episodic / budget / injury-prone segments. Tune freely.
HOSPITAL_WEIGHTS = {
    "Well-being Warriors": 1.00, "Ambitious Go-Getters": 1.00, "Security Seekers": 0.90,
    "Passionate Parents": 0.70, "Adventure Seekers": 0.50, "Comfort Companions": 0.35,
    "Prudent Pragmatists": 0.15,
}
URGENTCARE_WEIGHTS = {
    "Prudent Pragmatists": 1.00, "Adventure Seekers": 1.00, "Passionate Parents": 0.75,
    "Comfort Companions": 0.60, "Security Seekers": 0.50, "Ambitious Go-Getters": 0.35,
    "Well-being Warriors": 0.20,
}


def score_msas(enriched: pd.DataFrame, distributions: pd.DataFrame,
               hospital_weights: dict = HOSPITAL_WEIGHTS,
               urgentcare_weights: dict = URGENTCARE_WEIGHTS,
               msa_col: str = "msa_title", min_zips: int = 5) -> pd.DataFrame:
    """Per-MSA hospital-fit vs urgent-care-fit, with the recommended model tilt.

    Aggregates each MSA's pet-owner persona mix (mean over its ZIPs), then scores
    fit to each model. ``min_zips`` drops tiny MSAs for stability.
    """
    e = enriched[["zip", msa_col]].copy()
    e["zip"] = e["zip"].astype(str).str.zfill(5)
    d = distributions.copy(); d["zip"] = d["zip"].astype(str).str.zfill(5)
    wide = d.pivot_table(index="zip", columns="persona", values="share", fill_value=0.0)
    personas = list(wide.columns)

    g = e.dropna(subset=[msa_col]).merge(wide, left_on="zip", right_index=True, how="inner")
    agg = g.groupby(msa_col)
    mix = agg[personas].mean()
    n_zips = agg.size().rename("n_zips")
    mix = mix[n_zips >= min_zips]

    hw = pd.Series(hospital_weights).reindex(personas).fillna(0.0)
    uw = pd.Series(urgentcare_weights).reindex(personas).fillna(0.0)
    out = pd.DataFrame(index=mix.index)
    out["n_zips"] = n_zips.reindex(mix.index)
    out["hospital_fit"] = (mix.to_numpy() @ hw.to_numpy()).round(4)
    out["urgentcare_fit"] = (mix.to_numpy() @ uw.to_numpy()).round(4)
    out["tilt"] = (out["hospital_fit"] - out["urgentcare_fit"]).round(4)
    # Tilt vs the national average tilt -> who *relatively* leans which way.
    out["tilt_vs_natl"] = (out["tilt"] - out["tilt"].mean()).round(4)
    out["lean"] = pd.cut(out["tilt_vs_natl"], [-1, -0.005, 0.005, 1],
                         labels=["Urgent care", "Balanced", "Hospital"])
    for p in personas:
        out[p] = (mix[p] * 100).round(1)
    return out.sort_values("tilt_vs_natl", ascending=False)


def recommend(scorecard: pd.DataFrame, n: int = 15) -> dict:
    """Top metros leaning hospital vs urgent care (by relative tilt)."""
    return {
        "build_hospital": scorecard.sort_values("tilt_vs_natl", ascending=False).head(n),
        "build_urgent_care": scorecard.sort_values("tilt_vs_natl", ascending=True).head(n),
    }


__all__ = ["score_msas", "recommend", "HOSPITAL_WEIGHTS", "URGENTCARE_WEIGHTS"]
