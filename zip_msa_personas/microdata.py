"""Derive persona affinities from respondent-level NPOS microdata.

Given each survey respondent's persona + their full responses, this computes a
persona x variable table (survey-weighted) for any chosen columns -- purchase
incidence, spend, brand use, attitudes -- which feeds the market-fit engine. It
removes the need for pre-tabulated cross-tabs: any question becomes an affinity.

Handling: yes/no responses -> incidence (share answering yes); numeric -> mean
(e.g. annual spend); survey weights respected when a weight column is given.

PRIVACY: respondent microdata is sensitive (ZIP + full responses can re-identify).
Keep it in a controlled environment, never commit it, and let only the
*aggregated* persona-level affinities leave -- those carry no individual data.
"""
from __future__ import annotations

import pandas as pd

_YESNO = {"yes": 1, "no": 0, "y": 1, "n": 0, "true": 1, "false": 0, True: 1, False: 0,
          "1": 1, "0": 0}


def _to_numeric(s: pd.Series) -> pd.Series:
    mapped = s.map(lambda v: _YESNO.get(str(v).strip().lower(), v) if not isinstance(v, (int, float)) else v)
    return pd.to_numeric(mapped, errors="coerce")


def persona_affinity_table(microdata: pd.DataFrame, value_cols: list[str],
                           persona_col: str = "persona", weight_col: str | None = None) -> pd.DataFrame:
    """Persona x variable table: survey-weighted mean (incidence for yes/no) per column."""
    df = microdata.copy()
    w = pd.to_numeric(df[weight_col], errors="coerce").fillna(0.0) if weight_col else pd.Series(1.0, index=df.index)
    rows = {}
    for c in value_cols:
        v = _to_numeric(df[c])
        ok = v.notna()
        tmp = pd.DataFrame({"persona": df[persona_col], "v": v, "w": w})[ok.values]
        g = tmp.groupby("persona")
        rows[c] = g.apply(lambda d: (d["v"] * d["w"]).sum() / d["w"].sum() if d["w"].sum() else float("nan"))
    return pd.DataFrame(rows)


def derive_affinities(microdata: pd.DataFrame, value_cols: list[str],
                      persona_col: str = "persona", weight_col: str | None = None) -> dict:
    """Microdata -> persona x category table -> normalized affinity library."""
    from . import marketfit
    table = persona_affinity_table(microdata, value_cols, persona_col, weight_col)
    return marketfit.affinities_from_npos(table)


__all__ = ["persona_affinity_table", "derive_affinities"]
