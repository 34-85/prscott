"""Empirical-Bayes shrinkage for sparse survey ZIPs.

The APPA ZIP-level survey is thin -- a median of ~1 weighted respondent per ZIP,
with 79% of ZIPs below 2. Treating each ZIP's raw composition as ground truth is
overconfident: a single respondent is not a distribution.

Shrinkage pulls each ZIP's persona mix toward a **market prior** (its MSA/DMA, or
the national mix as fallback), weighted by how much data the ZIP actually has:

    shrunk_share(z, s) = ( w(z, s) + alpha * prior(market(z), s) ) / ( n(z) + alpha )

where ``n(z)`` is the ZIP's total weighted respondents and ``alpha`` is the prior
strength (in pseudo-respondents). A 1-respondent ZIP ends up mostly prior; a
20-respondent ZIP mostly stands on its own data. The fraction of own-data,
``n / (n + alpha)``, also drives an honest per-ZIP confidence so single-respondent
ZIPs no longer score ~1.0.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class ShrinkResult:
    distribution: pd.DataFrame      # zip, persona, share, weight, total_weight, market
    confidence: dict                # zip -> honest confidence (top shrunk share)
    alpha: float


def _prior(dist: pd.DataFrame) -> dict:
    s = dist.groupby("persona")["weight"].sum()
    total = s.sum()
    return (s / total).to_dict() if total else {}


def compute_priors(dist: pd.DataFrame, market_map: dict | None = None):
    """National prior plus, if a zip->market map is given, per-market priors."""
    national = _prior(dist)
    markets = {}
    if market_map:
        d = dist.assign(market=dist["zip"].map(market_map))
        for m, g in d.dropna(subset=["market"]).groupby("market"):
            markets[m] = _prior(g)
    return national, markets


def shrink(dist: pd.DataFrame, alpha: float = 5.0, market_map: dict | None = None) -> ShrinkResult:
    """Empirical-Bayes shrink each ZIP's persona distribution toward its market."""
    national, markets = compute_priors(dist, market_map)
    personas_all = sorted(dist["persona"].unique())
    totals = dist.groupby("zip")["weight"].sum()
    wmap = {(z, p): w for z, p, w in dist[["zip", "persona", "weight"]].itertuples(index=False)}

    rows, confidence = [], {}
    for z, n_z in totals.items():
        market = (market_map or {}).get(z)
        prior = markets.get(market) or national
        shares = {p: (wmap.get((z, p), 0.0) + alpha * prior.get(p, 0.0)) / (n_z + alpha) for p in personas_all}
        ssum = sum(shares.values()) or 1.0
        shares = {p: v / ssum for p, v in shares.items()}
        top = max(shares, key=lambda p: (shares[p], p))
        confidence[z] = round(shares[top], 4)
        for p, v in shares.items():
            if v > 0:
                rows.append((z, p, v, v * n_z, n_z, market))

    distribution = pd.DataFrame(rows, columns=["zip", "persona", "share", "weight", "total_weight", "market"])
    return ShrinkResult(distribution=distribution, confidence=confidence, alpha=alpha)


__all__ = ["ShrinkResult", "shrink", "compute_priors"]
