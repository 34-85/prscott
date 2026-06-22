"""Confidence-aware indexing: separate real over/under-indexing from noise.

An index of 150 (a persona is 1.5x the national average in a geography) means
nothing if it rests on one survey respondent. This computes, for each
(geography, persona) cell, the index vs national **and** a confidence interval
driven by the effective sample size, so you can tell a *real* skew from sampling
noise.

For a share ``p`` estimated from ``n`` (effective) respondents, the standard
error is ``sqrt(p(1-p)/n)``; the index CI is that band divided by the national
base rate. A cell is "significant" when the whole CI sits above or below 100.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def reliability_tier(n: float) -> str:
    if n < 5:
        return "very low (n<5)"
    if n < 30:
        return "low"
    if n < 100:
        return "moderate"
    return "solid"


def _wilson(p: float, n: float, z: float):
    """Wilson score interval for a proportion -- well-behaved at small n / extreme p
    (unlike the normal approximation, which gives a false-zero SE at p=0 or 1)."""
    if n <= 0:
        return (np.nan, np.nan)
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = (z / denom) * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return center - half, center + half


def index_with_significance(
    shares: pd.DataFrame,
    base_rates: dict,
    n: pd.Series,
    z: float = 1.96,
    min_n: float = 30.0,
) -> pd.DataFrame:
    """Long table of confidence-aware indices.

    Parameters
    ----------
    shares : geography x persona, within-geography shares (0..1).
    base_rates : {persona: national share}.
    n : effective sample size per geography (e.g. weighted respondents).
    z : z-score for the CI (1.96 = 95%); Wilson interval is used.
    min_n : a skew is only marked ``significant`` with at least this effective
        sample -- so a single respondent can never read as a "real" skew.

    Returns columns: geo, persona, share, n, index, index_lo, index_hi,
    direction, significant, reliability.
    """
    rows = []
    n = n.reindex(shares.index).fillna(0.0)
    for geo in shares.index:
        nn = float(n.loc[geo])
        for persona in shares.columns:
            base = max(base_rates.get(persona, np.nan), 1e-9)
            p = float(shares.loc[geo, persona])
            idx = p / base * 100
            lo_p, hi_p = _wilson(p, nn, z)
            lo = lo_p / base * 100 if nn > 0 else np.nan
            hi = hi_p / base * 100 if nn > 0 else np.nan
            enough = nn >= min_n
            if np.isnan(lo):
                sig, direction = False, "unknown"
            elif enough and lo > 100:
                sig, direction = True, "over"
            elif enough and hi < 100:
                sig, direction = True, "under"
            else:
                sig = False
                direction = "over" if idx > 110 else "under" if idx < 90 else "not distinguishable"
            rows.append({
                "geo": geo, "persona": persona, "share": round(p, 4), "n": round(nn, 1),
                "index": round(idx), "index_lo": None if np.isnan(lo) else round(lo),
                "index_hi": None if np.isnan(hi) else round(hi),
                "direction": direction, "significant": sig, "reliability": reliability_tier(nn),
            })
    return pd.DataFrame(rows)


def significant_skews(table: pd.DataFrame, direction: str = "over") -> pd.DataFrame:
    """Just the statistically real over- (or under-) indexing cells, ranked."""
    sub = table[(table["significant"]) & (table["direction"] == direction)]
    return sub.sort_values("index", ascending=(direction == "under")).reset_index(drop=True)


__all__ = ["index_with_significance", "significant_skews", "reliability_tier"]
