"""Plain-language lookups against the scored national dataset.

Powers the "just ask" workflow: given the enriched output + per-ZIP
distributions, answer the common business questions --
  * persona mix for a ZIP / DMA / MSA
  * the markets that most over-index on a persona
  * a one-line "siting read" for a ZIP
-- without anyone writing pandas.
"""
from __future__ import annotations

import pandas as pd


def _wide(distributions: pd.DataFrame) -> pd.DataFrame:
    d = distributions.copy()
    d["zip"] = d["zip"].astype(str).str.zfill(5)
    return d.pivot_table(index="zip", columns="persona", values="share", fill_value=0.0)


def mix_for_zip(distributions: pd.DataFrame, zip_code: str) -> pd.Series:
    """The full persona mix (%) for one ZIP, high to low."""
    w = _wide(distributions)
    z = str(zip_code).zfill(5)
    if z not in w.index:
        raise KeyError(f"ZIP {z} not in the dataset.")
    return (w.loc[z] * 100).round(1).sort_values(ascending=False)


def _zips_in_group(enriched: pd.DataFrame, group_col: str, value: str) -> list:
    e = enriched.copy()
    e["zip"] = e["zip"].astype(str).str.zfill(5)
    mask = e[group_col].astype(str).str.contains(str(value), case=False, na=False)
    return e[mask]["zip"].tolist()


def mix_for_group(enriched: pd.DataFrame, distributions: pd.DataFrame,
                  group_col: str, value: str) -> pd.Series:
    """Average persona mix (%) across the ZIPs in a market (MSA/DMA/state)."""
    zips = _zips_in_group(enriched, group_col, value)
    w = _wide(distributions)
    sub = w[w.index.isin(zips)]
    if sub.empty:
        raise KeyError(f"No ZIPs match {group_col} ~ '{value}'.")
    return (sub.mean() * 100).round(1).sort_values(ascending=False)


def top_markets_for_persona(enriched: pd.DataFrame, distributions: pd.DataFrame,
                            persona: str, group_col: str = "msa_title",
                            n: int = 20, base_rate: float | None = None,
                            min_survey: int = 0) -> pd.DataFrame:
    """Markets ranked by a persona's share (and index vs national if known).

    ``min_survey`` drops markets with too little real survey support behind them
    (the reliability filter) before taking the top ``n`` -- so a thin,
    spatially-smoothed small market can't spike to the top of the list.
    """
    from . import reliability
    e = enriched.copy()
    e["zip"] = e["zip"].astype(str).str.zfill(5)
    w = _wide(distributions)
    if persona not in w.columns:
        raise KeyError(f"Unknown persona '{persona}'. Options: {list(w.columns)}")
    g = e[["zip", group_col]].dropna(subset=[group_col]).merge(
        w[persona].rename("share"), left_on="zip", right_index=True, how="inner")
    agg = g.groupby(group_col)["share"].mean().sort_values(ascending=False)
    out = (agg * 100).round(1).rename("share_%").reset_index()
    if base_rate:
        out["index"] = (out["share_%"] / (base_rate * 100) * 100).round(0).astype(int)
    if min_survey:
        out = reliability.filter_table(out, enriched, group_col, min_survey=min_survey, drop=True)
    return out.head(n)


def siting_read(enriched: pd.DataFrame, distributions: pd.DataFrame, zip_code: str) -> str:
    """One-paragraph persona read for a ZIP (the vet-siting style summary)."""
    z = str(zip_code).zfill(5)
    mix = mix_for_zip(distributions, zip_code)
    row = enriched[enriched["zip"].astype(str).str.zfill(5) == z]
    msa = row["msa_title"].iloc[0] if len(row) and "msa_title" in row else "n/a"
    conf = row["confidence"].iloc[0] if len(row) else float("nan")
    basis = row["provenance"].iloc[0] if len(row) else "n/a"
    top3 = ", ".join(f"{p} {v}%" for p, v in mix.head(3).items())
    return (f"ZIP {z} (MSA: {msa}) — top personas: {top3}. "
            f"Confidence {conf:.2f}, basis: {basis}.")


__all__ = ["mix_for_zip", "mix_for_group", "top_markets_for_persona", "siting_read"]
