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


def build_volume_from_acs(enriched: pd.DataFrame, acs_features: pd.DataFrame,
                          ownership_rate: float = 0.66, msa_col: str = "msa_title") -> pd.DataFrame:
    """Per-MSA addressable pet households + income, from ACS ZCTA features.

    ``acs_features`` (from ``load_acs_zcta_features``) needs 'households' and
    'median_household_income'. Addressable pet HH = households x ownership_rate.
    """
    af = acs_features.copy(); af["zip"] = af["zip"].astype(str).str.zfill(5)
    e = enriched[["zip", msa_col]].copy(); e["zip"] = e["zip"].astype(str).str.zfill(5)
    m = e.merge(af[["zip", "households", "median_household_income"]], on="zip", how="inner").dropna(subset=[msa_col])
    m["households"] = pd.to_numeric(m["households"], errors="coerce").fillna(0.0)
    m["median_household_income"] = pd.to_numeric(m["median_household_income"], errors="coerce")
    # ACS encodes "median not available" as a large negative jam value
    # (e.g. -666666666); drop those so they don't poison the weighted mean.
    m.loc[m["median_household_income"] < 0, "median_household_income"] = pd.NA
    g = m.groupby(msa_col)
    hh = g["households"].sum()

    # Household-weighted mean of ZCTA median incomes (approx MSA income), over
    # only the ZCTAs that actually report an income.
    def _weighted_income(d: pd.DataFrame) -> float:
        v = d.dropna(subset=["median_household_income"])
        w = v["households"].sum()
        return float((v["median_household_income"] * v["households"]).sum() / w) if w > 0 else float("nan")

    inc = g.apply(_weighted_income)
    out = pd.DataFrame({"households": hh.round(0), "median_income": inc.round(0)})
    out["addressable_pet_hh"] = (out["households"] * ownership_rate).round(0)
    return out


def recommend_sites(scorecard: pd.DataFrame, avoid_quantile: float = 0.25) -> pd.DataFrame:
    """Final recommendation: avoid (low volume) / build hospital / build urgent care.

    Requires ``addressable_pet_hh`` (from ``build_volume_from_acs``). Avoid gate =
    bottom ``avoid_quantile`` of addressable demand; otherwise the persona lean
    decides the model. ``priority`` = addressable demand x fit for the chosen
    model (where to act first).
    """
    sc = scorecard.copy()
    if "addressable_pet_hh" not in sc:
        raise ValueError("Run build_volume_from_acs and merge addressable_pet_hh first.")
    thresh = sc["addressable_pet_hh"].quantile(avoid_quantile)
    rec = pd.Series("Either (balanced)", index=sc.index)
    rec[sc["lean"] == "Hospital"] = "Build hospital"
    rec[sc["lean"] == "Urgent care"] = "Build urgent care"
    rec[sc["addressable_pet_hh"] < thresh] = "Avoid (low volume)"
    sc["recommendation"] = rec
    chosen_fit = sc["hospital_fit"].where(sc["lean"] == "Hospital", sc["urgentcare_fit"])
    sc["priority"] = (sc["addressable_pet_hh"] * chosen_fit).round(0)
    sc.loc[sc["recommendation"] == "Avoid (low volume)", "priority"] = 0
    return sc.sort_values("priority", ascending=False)


__all__ = ["score_msas", "recommend", "build_volume_from_acs", "recommend_sites",
           "HOSPITAL_WEIGHTS", "URGENTCARE_WEIGHTS"]
