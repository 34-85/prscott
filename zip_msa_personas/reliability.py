"""Reliability filter: keep thin-sample markets from topping a ranking.

Spatial smoothing gives *every* ZIP a persona estimate, so a metro built almost
entirely from modeled ZIPs -- with few or no actual survey responses behind it --
can spike to the top of a "top markets" list. That is the Kankakee artifact: a
tiny market whose extreme index rests on one noisy surveyed neighbor, not on real
local signal.

This measures the genuine survey support behind each market -- how many of its
ZIPs an actual survey response reached -- and lets every ranking (vet, brand,
retailer, query) require a minimum before trusting a market: flag the thin ones,
or drop them. The persona *index* is still computed against the full national
mean; reliability only governs which markets are allowed to be *ranked*.
"""
from __future__ import annotations

import pandas as pd

# Provenance values that mean "an actual survey response reached this ZIP".
# Covers both pipeline paths: the impute path (``observed``) and the
# demographic-blend path (``survey_anchored``). Kept in sync with batch.py.
SURVEY_TIERS = ("observed", "survey_anchored")
DEFAULT_MIN_SURVEY = 3


def survey_support(enriched: pd.DataFrame, group_col: str = "msa_title",
                   prov_col: str = "provenance") -> pd.Series:
    """Per-market count of ZIPs backed by an actual survey response.

    Returns a Series indexed by market label. If the frame carries no provenance
    column we cannot measure support, so every market reports 0 (and thus fails
    any positive threshold -- fail-safe, not fail-open).
    """
    if group_col not in enriched.columns:
        return pd.Series(dtype=int)
    if prov_col not in enriched.columns:
        idx = enriched[group_col].dropna().unique()
        return pd.Series(0, index=idx, dtype=int)
    e = enriched[[group_col, prov_col]].dropna(subset=[group_col])
    sup = e[prov_col].isin(SURVEY_TIERS).groupby(e[group_col]).sum()
    return sup.astype(int)


def attach(ranked: pd.DataFrame, enriched: pd.DataFrame,
           min_survey: int = DEFAULT_MIN_SURVEY, group_col: str = "msa_title",
           prov_col: str = "provenance", drop: bool = False) -> pd.DataFrame:
    """Add ``survey_zips`` + ``reliable`` to a market-*indexed* ranking.

    ``ranked`` is indexed by market name (same labels as ``enriched[group_col]``).
    With ``drop=True`` the thin markets are removed; otherwise they are merely
    flagged (``reliable=False``) so the caller can show or sort them.
    """
    sup = survey_support(enriched, group_col, prov_col)
    out = ranked.copy()
    out["survey_zips"] = [int(sup.get(m, 0)) for m in out.index]
    out["reliable"] = out["survey_zips"] >= int(min_survey)
    return out[out["reliable"]] if drop else out


def filter_table(ranked: pd.DataFrame, enriched: pd.DataFrame, group_col: str,
                 min_survey: int = DEFAULT_MIN_SURVEY, prov_col: str = "provenance",
                 drop: bool = False) -> pd.DataFrame:
    """Like :func:`attach`, but for a long ranking that has ``group_col`` as a
    regular column (e.g. a reset-index table)."""
    sup = survey_support(enriched, group_col, prov_col)
    out = ranked.copy()
    out["survey_zips"] = out[group_col].map(lambda m: int(sup.get(m, 0)))
    out["reliable"] = out["survey_zips"] >= int(min_survey)
    return out[out["reliable"]].reset_index(drop=True) if drop else out


DEFAULT_MODEL_FLOOR = 0.15


def zip_weights(enriched: pd.DataFrame, support_col: str = "support",
                model_floor: float = DEFAULT_MODEL_FLOOR) -> "pd.Series | None":
    """Per-ZIP aggregation weight from survey support, or ``None`` if unavailable.

    Returns a Series (zip -> weight) where a well-sampled survey ZIP (support -> 1)
    outweighs a thin one, and modeled / zero-support ZIPs sit at ``model_floor`` so
    the demographic universe still contributes a baseline. This is what keeps a
    sparse survey ZIP (e.g. a 1-2 respondent spike) from dominating a metro mix.
    If the frame carries no ``support`` column we return ``None`` and callers fall
    back to an equal-weight mean (backward compatible).
    """
    if support_col not in enriched.columns:
        return None
    e = enriched[["zip", support_col]].copy()
    e["zip"] = e["zip"].astype(str).str.zfill(5)
    s = pd.to_numeric(e[support_col], errors="coerce").fillna(0.0).clip(0.0, 1.0).clip(lower=model_floor)
    return pd.Series(s.to_numpy(), index=e["zip"])


def weighted_group_mean(frame: pd.DataFrame, group_col: str, value_cols: list,
                        weight: str = "_w") -> pd.DataFrame:
    """Per-group weighted mean of ``value_cols`` using the ``weight`` column."""
    def _wm(g):
        w = g[weight].to_numpy()
        tot = w.sum() or 1.0
        return pd.Series((g[value_cols].mul(w, axis=0).sum()) / tot, index=value_cols)
    return frame.groupby(group_col, group_keys=True).apply(_wm)


__all__ = ["survey_support", "attach", "filter_table", "zip_weights", "weighted_group_mean",
           "SURVEY_TIERS", "DEFAULT_MIN_SURVEY", "DEFAULT_MODEL_FLOOR"]
