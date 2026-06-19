"""Persona -> offer -> location fit scoring (the Phase-2 revenue layer).

Given a client's *target personas* (e.g. a premium-food brand's high-value
pet-owner segments, or a vet group's priority segments), rank ZIPs and MSAs by
how well the local pet-owner population fits the offer -- and surface
*whitespace*: strong-fit locations where the client has no presence.

Design choices that make this sellable:
* **Estimate-aware.** Each ZIP's fit is scaled by the persona confidence, so
  opportunity built on modeled/extrapolated ZIPs is visibly discounted and the
  observed vs estimated split is reported, never hidden.
* **Addressable, not just fit.** Multiplying by a size measure (population /
  households) turns a fit score into an opportunity *magnitude* a client can act
  on.
* **Explainable.** Score = persona fit x confidence x size. No black box.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from . import impute


@dataclass
class OpportunityResult:
    zip_scores: pd.DataFrame   # per-ZIP fit / score / addressable / whitespace
    msa_scores: pd.DataFrame   # aggregated to MSA, ranked by addressable opportunity
    target_personas: dict      # normalized weights actually used

    def __str__(self) -> str:
        top = self.msa_scores.head(10)
        return (
            f"Target personas: {self.target_personas}\n\n"
            f"Top MSAs by addressable opportunity:\n{top.to_string(index=False)}"
        )


def _normalize(target_personas: dict) -> dict:
    total = sum(max(0.0, float(v)) for v in target_personas.values()) or 1.0
    return {k: max(0.0, float(v)) / total for k, v in target_personas.items()}


def score_opportunity(
    enriched: pd.DataFrame,
    target_personas: dict,
    sizes: pd.DataFrame | None = None,
    size_col: str = "population",
    footprint_zips=None,
    whitespace_fit: float = 0.5,
) -> OpportunityResult:
    """Score every ZIP for fit to the target personas, then roll up to MSA.

    Parameters
    ----------
    enriched : pipeline output (zip, persona, confidence, provenance, msa_*).
    target_personas : {persona: weight}. Weights are normalized internally.
    sizes : optional DataFrame [zip, <size_col>] for addressable sizing.
    footprint_zips : ZIPs the client already operates in (for whitespace).
    whitespace_fit : min fit to count an out-of-footprint ZIP as whitespace.
    """
    weights = _normalize(target_personas)
    df = enriched.copy()
    df["zip"] = df["zip"].astype(str).str.zfill(5)

    if sizes is not None:
        s = sizes.copy()
        s["zip"] = s["zip"].astype(str).str.zfill(5)
        df = df.merge(s[["zip", size_col]], on="zip", how="left")
    size = pd.to_numeric(df[size_col], errors="coerce").fillna(0.0) if size_col in df else pd.Series(1.0, index=df.index)

    df["fit"] = df["persona"].map(weights).fillna(0.0)
    df["confidence"] = pd.to_numeric(df["confidence"], errors="coerce").fillna(0.0)
    df["opportunity_score"] = df["fit"] * df["confidence"]
    df["addressable"] = df["opportunity_score"] * size

    fp = {str(z).zfill(5) for z in (footprint_zips or [])}
    df["in_footprint"] = df["zip"].isin(fp)
    df["whitespace"] = (df["fit"] >= whitespace_fit) & (~df["in_footprint"])
    df["is_estimated"] = df["provenance"] != impute.OBSERVED

    zip_scores = df.sort_values("opportunity_score", ascending=False).reset_index(drop=True)

    msa_scores = (
        df.dropna(subset=["msa_cbsa"])
        .groupby(["msa_cbsa", "msa_title"])
        .agg(
            zips=("zip", "size"),
            mean_fit=("fit", "mean"),
            total_addressable=("addressable", "sum"),
            addressable_observed=("addressable", lambda s: s[~df.loc[s.index, "is_estimated"]].sum()),
            whitespace_zips=("whitespace", "sum"),
            pct_estimated=("is_estimated", "mean"),
        )
        .reset_index()
        .sort_values("total_addressable", ascending=False)
    )
    msa_scores["pct_addressable_estimated"] = 1 - (
        msa_scores["addressable_observed"] / msa_scores["total_addressable"].replace(0, pd.NA)
    )
    return OpportunityResult(zip_scores, msa_scores, weights)


__all__ = ["OpportunityResult", "score_opportunity"]
