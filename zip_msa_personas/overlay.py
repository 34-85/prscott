"""Overlay an external city list onto the market-viability grades.

Use case: a partner hands you a list of municipalities (e.g. Mars Petcare's
"Better Cities for Pets" certified communities) and you want to know how that
footprint lines up with our market viability -- are the certified cities in the
high-opportunity metros, or scattered across thin/low-value markets?

The list is municipalities; our viability sheet is keyed by CBSA/MSA. So we map
each city -> its metro using public ZIP geography (GeoNames city/state -> ZIP)
joined to the scored ``enriched`` (ZIP -> msa_title, majority vote), then join
the metro's viability grade. Cities we can't place (non-US, or no ZIP match) are
reported, never silently dropped.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

DEFAULT_CITY_LIST = Path(__file__).parent / "data" / "better_cities_for_pets.txt"

# State words that aren't US two-letter codes -> these can't map to a US CBSA.
_NON_US = {"ONTARIO", "QUEBEC", "BRITISH COLUMBIA", "ALBERTA"}
_STATE_FIX = {"D.C.": "DC", "DC.": "DC", "PUERTO RICO": "PR"}


def _norm_city(s: str) -> str:
    """Lowercase, strip punctuation/whitespace for a forgiving city-name match."""
    return re.sub(r"[^a-z0-9 ]", "", str(s).strip().lower()).strip()


def parse_city_lines(lines) -> pd.DataFrame:
    """Parse 'City, ST' lines -> DataFrame[city, state, raw], skipping comments."""
    rows = []
    for ln in lines:
        ln = ln.strip()
        if not ln or ln.startswith("#") or "," not in ln:
            continue
        city, state = ln.rsplit(",", 1)
        st = state.strip().upper().rstrip(".")
        st = _STATE_FIX.get(state.strip().upper(), st)
        rows.append({"city": city.strip(), "state": st, "raw": ln,
                     "city_key": _norm_city(city), "us": st not in _NON_US and len(st) == 2})
    return pd.DataFrame(rows)


def load_city_list(path=DEFAULT_CITY_LIST) -> pd.DataFrame:
    return parse_city_lines(Path(path).read_text().splitlines())


def city_to_msa(enriched: pd.DataFrame, geography: pd.DataFrame,
                msa_col: str = "msa_title") -> pd.DataFrame:
    """Map (city_key, state) -> the metro most of its ZIPs belong to.

    ``geography`` is ``deliverables.load_geography`` output (zip, city, state).
    ``enriched`` supplies zip -> msa_title. Majority vote per city handles ZIPs
    that straddle a metro edge.
    """
    g = geography[["zip", "city", "state"]].copy()
    g["zip"] = g["zip"].astype(str).str.zfill(5)
    g["city_key"] = g["city"].map(_norm_city)
    g["state"] = g["state"].astype(str).str.upper()
    e = enriched[["zip", msa_col]].copy()
    e["zip"] = e["zip"].astype(str).str.zfill(5)
    m = g.merge(e, on="zip", how="inner").dropna(subset=[msa_col])
    # Most common MSA per (city_key, state), with how many ZIPs back it.
    grp = m.groupby(["city_key", "state", msa_col]).size().rename("n").reset_index()
    grp = grp.sort_values("n", ascending=False).drop_duplicates(["city_key", "state"])
    return grp.rename(columns={msa_col: "msa_title"})[["city_key", "state", "msa_title", "n"]]


def align(cities: pd.DataFrame, city_msa: pd.DataFrame, viability: pd.DataFrame,
          msa_col: str = "msa_title") -> dict:
    """Join cities -> metro -> viability grade. Returns detail + summary + unmatched."""
    vi = viability.copy()
    if msa_col not in vi.columns and vi.index.name == msa_col:
        vi = vi.reset_index()
    keep = [c for c in ["market_grade", "recommendation", "opportunity_score",
                        "persona_value_index", "high_value_overindex", "reliable",
                        "survey_zips", "median_income"] if c in vi.columns]
    detail = cities.merge(city_msa, on=["city_key", "state"], how="left")
    detail = detail.merge(vi[[msa_col] + keep], on=msa_col, how="left")
    matched = detail[detail["market_grade"].notna()] if "market_grade" in detail else detail.iloc[0:0]
    unmatched = detail[detail[msa_col].isna()]

    grade_dist = (matched["market_grade"].value_counts().reindex(["A", "B", "C", "D"]).fillna(0).astype(int)
                  if "market_grade" in matched else pd.Series(dtype=int))
    # Compare to the universe: are certified cities richer in A/B than all metros?
    base = (viability["market_grade"].value_counts(normalize=True).reindex(["A", "B", "C", "D"]).fillna(0)
            if "market_grade" in viability else pd.Series(dtype=float))

    # Metro-clustering correction: many certified cities collapse onto the same
    # metro (10+ CA suburbs -> LA/SF), so a per-city grade count overstates how
    # many *distinct* high-grade markets the certification actually touches.
    metros = (matched.drop_duplicates(msa_col) if msa_col in matched else matched.iloc[0:0])
    metro_grade_dist = (metros["market_grade"].value_counts().reindex(["A", "B", "C", "D"]).fillna(0).astype(int)
                        if "market_grade" in metros else pd.Series(dtype=int))
    # The most-clustered metros (how many certified cities map to each).
    metro_counts = (matched.groupby(msa_col).size().sort_values(ascending=False)
                    if msa_col in matched and len(matched) else pd.Series(dtype=int))

    return {
        "detail": detail.sort_values("opportunity_score", ascending=False)
                  if "opportunity_score" in detail else detail,
        "matched": matched, "unmatched": unmatched,
        "grade_dist": grade_dist, "universe_share": base,
        "metro_grade_dist": metro_grade_dist, "metro_counts": metro_counts,
        "n_total": len(cities), "n_matched": len(matched), "n_unmatched": len(unmatched),
        "n_metros": int(metros[msa_col].nunique()) if msa_col in metros else 0,
    }


__all__ = ["parse_city_lines", "load_city_list", "city_to_msa", "align", "DEFAULT_CITY_LIST"]
