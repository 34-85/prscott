"""Economic value of personas + the combined market-viability sheet.

"Which personas are worth the most, and which markets concentrate them?" The
per-persona economic value is derived **from the deck fingerprints, not by hand**:
each persona's premium-spend index x high-income index (both likelihood ratios,
100 = national average) -> a single value weight. Security Seekers and Ambitious
Go-Getters land far above average; Prudent Pragmatists far below -- matching the
deck's spend narrative.

``build_viability`` then assembles the one-sheet market view that pairs that
persona-value lens with HH income, addressable demand, and the vet-siting service
model -- and it **always applies the reliability filter**, so a thin,
spatially-smoothed small market can't read as "most viable" on noise (the
Kankakee artifact). Every market stays in the sheet, but unreliable ones are
flagged and capped below Grade A.

Honesty notes carried by every run:
  * The persona-value ranking is directional -- it rests on the deck's spend /
    income indices, because realized ZIP-level persona income barely separates.
  * Market median income is the real economic discriminator and is in the score.
  * It is demand-side only -- no competition / whitespace layer.
"""
from __future__ import annotations

import pandas as pd

# Personas whose value weight sits clearly above / below the national average
# (see ``persona_value_weights``). Used for the high/low over-index columns.
HIGH_VALUE_PERSONAS = ("Security Seekers", "Ambitious Go-Getters", "Well-being Warriors")
LOW_VALUE_PERSONAS = ("Prudent Pragmatists", "Passionate Parents")

NOTES = (
    "Persona-value ranking is directional (deck spend/income indices; realized "
    "ZIP-level persona income barely separates). Market median income is the real "
    "economic discriminator and is already in the score. Demand-side only -- no "
    "competition/whitespace layer; Grade A = biggest opportunity, not confirmed "
    "whitespace. Markets with < min_survey survey-backed ZIPs are flagged "
    "unreliable and capped below Grade A."
)


def persona_value_weights(normalize: bool = True) -> pd.Series:
    """Per-persona economic value = premium-spend index x high-income index.

    Both come from ``data/persona_fingerprints.json`` (100 = national average), so
    the weighting is grounded in the survey, not asserted. With ``normalize`` the
    weights are scaled to mean 1.0 (the absolute scale cancels in any index).
    """
    from . import propensity
    fp = propensity.load_fingerprints().fingerprints
    raw = {p: (d["spend"]["premium"] / 100.0) * (d["income"]["high"] / 100.0)
           for p, d in fp.items()}
    s = pd.Series(raw, dtype=float)
    return s / s.mean() if normalize else s


def persona_value_table() -> pd.DataFrame:
    """Transparency table: premium index, high-income index, value weight, value
    index (100 = average persona), high to low."""
    from . import propensity
    fp = propensity.load_fingerprints().fingerprints
    w = persona_value_weights()
    rows = [{"persona": p, "premium_spend_index": fp[p]["spend"]["premium"],
             "high_income_index": fp[p]["income"]["high"],
             "value_weight": round(float(w[p]), 3),
             "value_index": round(float(w[p]) * 100)} for p in fp]
    return pd.DataFrame(rows).sort_values("value_index", ascending=False).reset_index(drop=True)


def _national_mix(distributions: pd.DataFrame) -> pd.Series:
    """Equal-weight-per-ZIP national persona mix -- the reference for indices,
    consistent with how MSA mixes are averaged over their ZIPs."""
    d = distributions.copy(); d["zip"] = d["zip"].astype(str).str.zfill(5)
    wide = d.pivot_table(index="zip", columns="persona", values="share", fill_value=0.0)
    return wide.mean()


def _grade(score: pd.Series, reliable: pd.Series) -> pd.Series:
    """A-D on opportunity-score quantiles; unreliable markets capped at C."""
    q = score.rank(pct=True)
    g = pd.Series("D", index=score.index)
    g[q >= 0.60] = "C"
    g[q >= 0.80] = "B"
    g[q >= 0.92] = "A"
    g[(~reliable) & g.isin(["A", "B"])] = "C"   # thin support can't grade A/B
    return g


def build_viability(enriched: pd.DataFrame, distributions: pd.DataFrame,
                    acs_features: pd.DataFrame | None = None, min_survey: int = 3,
                    min_zips: int = 8, ownership_rate: float = 0.66,
                    avoid_quantile: float = 0.25) -> pd.DataFrame:
    """The combined per-MSA sheet: persona-value + over-index + income +
    addressable demand + vet-siting model, reliability-filtered.

    ``acs_features`` (from ``load_acs_zcta_features``) unlocks median_income,
    addressable_pet_hh, and the build/avoid recommendation. Without it the sheet
    is persona-value + over-index + fit only (no income-weighted score).
    """
    from . import marketfit, vetsiting, reliability

    mix = marketfit.msa_persona_mix(enriched, distributions, min_zips=min_zips)  # carries survey_zips
    personas = [c for c in mix.columns if c not in ("n_zips", "survey_zips")]
    natl = _national_mix(distributions).reindex(personas).fillna(0.0)
    w = persona_value_weights().reindex(personas).fillna(0.0)

    out = pd.DataFrame(index=mix.index)
    # Persona value index (100 = national).
    natl_fit = float((natl * w).sum()) or 1.0
    out["persona_value_index"] = (mix[personas].to_numpy() @ w.to_numpy() / natl_fit * 100).round()

    def _group_overindex(group):
        cols = [p for p in group if p in personas]
        base = float(natl[cols].sum()) or 1e-9
        return (mix[cols].sum(axis=1) / base * 100).round()
    out["high_value_overindex"] = _group_overindex(HIGH_VALUE_PERSONAS)
    out["low_value_overindex"] = _group_overindex(LOW_VALUE_PERSONAS)

    # Vet-siting service-model fit + lean (reliability-aware).
    sc = vetsiting.score_msas(enriched, distributions, min_zips=min_zips, min_survey=min_survey)
    out = out.join(sc[["hospital_fit", "urgentcare_fit", "tilt_vs_natl", "lean",
                       "survey_zips", "reliable"]])

    if acs_features is not None:
        vol = vetsiting.build_volume_from_acs(enriched, acs_features, ownership_rate=ownership_rate)
        out = out.join(vol[["median_income", "addressable_pet_hh"]])
        sc2 = sc.join(vol)
        sc2 = vetsiting.recommend_sites(sc2, avoid_quantile=avoid_quantile)
        out["recommendation"] = sc2["recommendation"]
        out["priority"] = sc2["priority"]
        # Opportunity = addressable demand x income x persona value.
        inc = out["median_income"].fillna(out["median_income"].median())
        hh = out["addressable_pet_hh"].fillna(0.0)
        out["opportunity_score"] = (hh * inc * (out["persona_value_index"] / 100.0)).round(0)
    else:
        out["recommendation"] = out["lean"].map(
            {"Hospital": "Build hospital", "Urgent care": "Build urgent care"}).fillna("Either (balanced)")
        out.loc[~out["reliable"], "recommendation"] = "Insufficient survey support"
        out["priority"] = float("nan")
        # No income -> demand proxy from coverage x persona value (clearly weaker).
        out["opportunity_score"] = (sc["n_zips"].reindex(out.index).fillna(0) *
                                    (out["persona_value_index"] / 100.0)).round(0)

    out["market_grade"] = _grade(out["opportunity_score"], out["reliable"])
    out["n_zips"] = sc["n_zips"].reindex(out.index)
    for p in personas:                                   # persona shares (%)
        out[p] = (mix[p] * 100).round(1)

    cols = ["market_grade", "recommendation", "opportunity_score", "persona_value_index",
            "high_value_overindex", "low_value_overindex", "reliable", "survey_zips",
            "median_income", "addressable_pet_hh", "hospital_fit", "urgentcare_fit",
            "tilt_vs_natl", "lean", "priority", "n_zips"] + personas
    cols = [c for c in cols if c in out.columns]
    return out[cols].sort_values("opportunity_score", ascending=False)


__all__ = ["persona_value_weights", "persona_value_table", "build_viability",
           "HIGH_VALUE_PERSONAS", "LOW_VALUE_PERSONAS", "NOTES"]
