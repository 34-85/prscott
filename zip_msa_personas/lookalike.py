"""Lookalike / market-expansion: find markets like a client's best ones.

Given a set of seed geographies (e.g. a brand's top-performing store ZIPs or
DMAs), rank every other market by how similar its persona profile is to the
seeds' average — then exclude where the client already operates to surface
**expansion whitespace**: "markets that look like your winners, where you're not
yet present."

Similarity is cosine on the persona-mix vectors (scale-invariant, so it compares
*composition*, not size). Works on any geo x persona profile matrix — ZIP, DMA,
or MSA — and equally on demographic-propensity mixes.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _unit(m: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(m, axis=1, keepdims=True)
    norm[norm == 0] = 1.0
    return m / norm


def find_lookalikes(
    profiles: pd.DataFrame,
    seeds: list,
    *,
    exclude: list | None = None,
    top_n: int = 50,
) -> pd.DataFrame:
    """Rank geographies by persona-profile similarity to the seed average.

    Parameters
    ----------
    profiles : geography x persona shares (one row per market).
    seeds : geographies that define the target profile (the client's winners).
    exclude : geographies to drop from results (e.g. current footprint). The
        seeds are always excluded. Defaults to the seeds themselves.
    top_n : how many lookalikes to return.

    Returns columns: geo, similarity (0..1), plus the persona-share columns, and
    ``top_personas`` summarizing the seed profile match.
    """
    present = [s for s in seeds if s in profiles.index]
    if not present:
        raise ValueError("None of the seed geographies are in the profile matrix.")
    centroid = profiles.loc[present].mean(axis=0).to_numpy(float).reshape(1, -1)
    centroid_u = _unit(centroid)

    M = profiles.to_numpy(float)
    sims = (_unit(M) @ centroid_u.T).ravel()
    out = profiles.copy()
    out.insert(0, "similarity", np.round(sims, 4))

    drop = set(present) | set(exclude or [])
    out = out.drop(index=[g for g in drop if g in out.index], errors="ignore")
    out = out.sort_values("similarity", ascending=False).head(top_n)
    return out.reset_index().rename(columns={"index": "geo", profiles.index.name or "index": "geo"})


def seed_profile(profiles: pd.DataFrame, seeds: list) -> pd.Series:
    """The average persona mix of the seed markets (what we're matching to)."""
    present = [s for s in seeds if s in profiles.index]
    return profiles.loc[present].mean(axis=0).sort_values(ascending=False)


__all__ = ["find_lookalikes", "seed_profile"]
