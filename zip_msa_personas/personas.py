"""Stage 2: load the user's persona file and join it onto ZIP -> MSA.

Expected input (flexible): a CSV/Excel with at least a ZIP column and a persona
column. An optional weight/count column lets a single ZIP carry several
personas with relative sizes; absent that, each row counts as 1.

After aggregation each ZIP carries a *persona distribution* (shares that sum to
1), which is what the imputation stage learns from and predicts.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

# Column-name autodetection -- case/space/underscore insensitive.
_ZIP_ALIASES = {"zip", "zipcode", "zip_code", "postal", "postalcode", "postal_code"}
_PERSONA_ALIASES = {"persona", "segment", "personas", "cluster", "audience"}
_WEIGHT_ALIASES = {"weight", "count", "n", "households", "people", "size", "volume"}


def _norm(col: str) -> str:
    return col.strip().lower().replace(" ", "").replace("_", "")


def _find(columns, aliases, normalized_aliases=None):
    norm_aliases = normalized_aliases or {a.replace("_", "") for a in aliases}
    for c in columns:
        if _norm(c) in norm_aliases:
            return c
    return None


def load_personas(path: str | Path, zip_col=None, persona_col=None, weight_col=None) -> pd.DataFrame:
    """Read a persona file into tidy (zip, persona, weight) rows."""
    path = Path(path)
    if path.suffix.lower() in {".xlsx", ".xls"}:
        df = pd.read_excel(path, dtype=str)
    else:
        df = pd.read_csv(path, dtype=str)

    zip_col = zip_col or _find(df.columns, _ZIP_ALIASES)
    persona_col = persona_col or _find(df.columns, _PERSONA_ALIASES)
    weight_col = weight_col or _find(df.columns, _WEIGHT_ALIASES)
    if zip_col is None or persona_col is None:
        raise ValueError(
            f"Could not locate zip/persona columns in {list(df.columns)}. "
            "Pass zip_col= and persona_col= explicitly."
        )

    out = pd.DataFrame(
        {
            "zip": df[zip_col].astype(str).str.extract(r"(\d{1,5})")[0].str.zfill(5),
            "persona": df[persona_col].astype(str).str.strip(),
        }
    )
    out["weight"] = (
        pd.to_numeric(df[weight_col], errors="coerce").fillna(1.0)
        if weight_col
        else 1.0
    )
    out = out.dropna(subset=["zip"])
    out = out[out["persona"].str.len() > 0]
    return out


def aggregate_to_zip_distribution(personas: pd.DataFrame) -> pd.DataFrame:
    """Collapse rows to one persona-share distribution per ZIP.

    Returns long format: zip, persona, weight, share, total_weight.
    """
    grp = personas.groupby(["zip", "persona"], as_index=False)["weight"].sum()
    totals = grp.groupby("zip", as_index=False)["weight"].sum().rename(columns={"weight": "total_weight"})
    grp = grp.merge(totals, on="zip")
    grp["share"] = grp["weight"] / grp["total_weight"]
    return grp


def top_persona_per_zip(distribution: pd.DataFrame) -> pd.DataFrame:
    """The single dominant persona per observed ZIP (for classifier targets)."""
    d = distribution.sort_values(["zip", "share", "persona"], ascending=[True, False, True])
    return d.groupby("zip", as_index=False).first()[["zip", "persona", "share", "total_weight"]]


def join_personas_to_msa(distribution: pd.DataFrame, zip_to_msa: pd.DataFrame) -> pd.DataFrame:
    """Attach the dominant Metro MSA to each observed (zip, persona) row."""
    return distribution.merge(zip_to_msa, on="zip", how="left")


__all__ = [
    "load_personas",
    "aggregate_to_zip_distribution",
    "top_persona_per_zip",
    "join_personas_to_msa",
]
