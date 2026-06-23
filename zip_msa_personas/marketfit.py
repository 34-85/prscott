"""Brand & retailer market-fit: persona -> product category / retail format.

Generalizes the vet-siting idea. Two questions brands and retailers ask:

  1. MARKET PRIORITIZATION -- "where should we push product line X?"
     Score every metro by how well its pet-owner mix fits a category's target
     personas, x addressable demand. (Like vet-siting, but the affinity profile
     is a product category instead of a service model.)

  2. ASSORTMENT / CATEGORY MIX -- "what should we emphasize in *this* metro?"
     Given a metro's persona mix, index every category by local appeal -> which
     lines to over- or under-weight in stores / marketing there.

The persona->category weights below are a starting hypothesis from the deck's
spend/attitude signals; tune them with the brand's category knowledge.
"""
from __future__ import annotations

import pandas as pd

# Category / format -> persona affinity (0..1). Starter library; refine freely.
CATEGORY_AFFINITY = {
    "Premium / fresh food":   {"Ambitious Go-Getters": 1.0, "Passionate Parents": 0.9, "Well-being Warriors": 0.9,
                               "Security Seekers": 0.8, "Adventure Seekers": 0.5, "Comfort Companions": 0.4, "Prudent Pragmatists": 0.1},
    "Value / private-label":  {"Prudent Pragmatists": 1.0, "Comfort Companions": 0.8, "Adventure Seekers": 0.5,
                               "Passionate Parents": 0.4, "Well-being Warriors": 0.3, "Security Seekers": 0.3, "Ambitious Go-Getters": 0.2},
    "Functional / health":    {"Well-being Warriors": 1.0, "Security Seekers": 0.7, "Ambitious Go-Getters": 0.7,
                               "Passionate Parents": 0.6, "Adventure Seekers": 0.5, "Comfort Companions": 0.4, "Prudent Pragmatists": 0.2},
    "Treats / indulgence":    {"Passionate Parents": 1.0, "Ambitious Go-Getters": 0.9, "Comfort Companions": 0.7,
                               "Well-being Warriors": 0.6, "Security Seekers": 0.6, "Adventure Seekers": 0.6, "Prudent Pragmatists": 0.3},
    "Toys / enrichment":      {"Passionate Parents": 1.0, "Adventure Seekers": 0.9, "Ambitious Go-Getters": 0.8,
                               "Well-being Warriors": 0.6, "Comfort Companions": 0.5, "Security Seekers": 0.5, "Prudent Pragmatists": 0.3},
    "Outdoor / travel gear":  {"Adventure Seekers": 1.0, "Ambitious Go-Getters": 0.7, "Well-being Warriors": 0.6,
                               "Security Seekers": 0.5, "Passionate Parents": 0.5, "Comfort Companions": 0.3, "Prudent Pragmatists": 0.3},
    "Tech / smart / status":  {"Ambitious Go-Getters": 1.0, "Security Seekers": 0.9, "Passionate Parents": 0.6,
                               "Well-being Warriors": 0.6, "Adventure Seekers": 0.6, "Comfort Companions": 0.3, "Prudent Pragmatists": 0.2},
    "Grooming / aesthetics":  {"Ambitious Go-Getters": 1.0, "Passionate Parents": 0.8, "Security Seekers": 0.7,
                               "Well-being Warriors": 0.6, "Comfort Companions": 0.5, "Adventure Seekers": 0.5, "Prudent Pragmatists": 0.2},
}

# Retail formats reuse the same machinery.
FORMAT_AFFINITY = {
    "Premium specialty":  {"Ambitious Go-Getters": 1.0, "Well-being Warriors": 0.9, "Security Seekers": 0.85,
                           "Passionate Parents": 0.8, "Adventure Seekers": 0.6, "Comfort Companions": 0.4, "Prudent Pragmatists": 0.15},
    "Value / mass":       {"Prudent Pragmatists": 1.0, "Comfort Companions": 0.85, "Adventure Seekers": 0.5,
                           "Passionate Parents": 0.45, "Well-being Warriors": 0.35, "Security Seekers": 0.35, "Ambitious Go-Getters": 0.25},
}


# Non-persona bookkeeping columns carried alongside the persona shares in a mix.
_META_COLS = ("n_zips", "survey_zips")


def msa_persona_mix(enriched: pd.DataFrame, distributions: pd.DataFrame,
                    msa_col: str = "msa_title", min_zips: int = 8,
                    model_floor: float = 0.15) -> pd.DataFrame:
    """Mean pet-owner persona mix per MSA (with n_zips + survey_zips), the shared
    substrate. ``survey_zips`` is how many of the metro's ZIPs an actual survey
    response reached -- the basis for the reliability filter on any ranking.

    When ``enriched`` carries a per-ZIP ``support`` column (survey effective
    sample), ZIPs are combined by a **support-weighted** mean so a thin survey
    ZIP can't dominate the metro mix; otherwise it falls back to an equal-weight
    mean (backward compatible)."""
    from . import reliability
    e = enriched[["zip", msa_col]].copy(); e["zip"] = e["zip"].astype(str).str.zfill(5)
    d = distributions.copy(); d["zip"] = d["zip"].astype(str).str.zfill(5)
    wide = d.pivot_table(index="zip", columns="persona", values="share", fill_value=0.0)
    cols = list(wide.columns)
    m = e.dropna(subset=[msa_col]).merge(wide, left_on="zip", right_index=True, how="inner")
    w = reliability.zip_weights(enriched, model_floor=model_floor)
    m["_w"] = m["zip"].map(w).fillna(model_floor) if w is not None else 1.0
    mix = reliability.weighted_group_mean(m, msa_col, cols)
    mix["n_zips"] = m.groupby(msa_col).size()
    sup = reliability.survey_support(enriched, msa_col)
    mix["survey_zips"] = [int(sup.get(mm, 0)) for mm in mix.index]
    return mix[mix["n_zips"] >= min_zips]


def _fit(mix: pd.DataFrame, affinity: dict) -> pd.Series:
    personas = [c for c in mix.columns if c not in _META_COLS]
    w = pd.Series(affinity).reindex(personas).fillna(0.0)
    return (mix[personas].to_numpy() @ w.to_numpy())


def market_fit(mix: pd.DataFrame, affinity: dict, min_survey: int = 0,
               drop_unreliable: bool = False) -> pd.DataFrame:
    """Per-MSA fit + index vs national for one category/format.

    The index is computed against the full national mean; ``min_survey`` then
    flags (or, with ``drop_unreliable``, removes) markets whose ranking rests on
    too little real survey support -- so a thin small market can't top the list.
    """
    fit = pd.Series(_fit(mix, affinity), index=mix.index)
    out = pd.DataFrame({"fit": fit.round(4), "index": (fit / fit.mean() * 100).round(0),
                        "n_zips": mix["n_zips"]})
    if "survey_zips" in mix.columns:
        out["survey_zips"] = mix["survey_zips"]
        out["reliable"] = out["survey_zips"] >= int(min_survey)
        if drop_unreliable:
            out = out[out["reliable"]]
    return out.sort_values("index", ascending=False)


def assortment_index(mix: pd.DataFrame, msa: str, library: dict = CATEGORY_AFFINITY) -> pd.DataFrame:
    """For one metro, index every category by local appeal vs national avg.

    >100 = over-index here (emphasize); <100 = under-index (de-emphasize).
    """
    rows = []
    for cat, aff in library.items():
        fit = pd.Series(_fit(mix, aff), index=mix.index)
        if msa in fit.index:
            rows.append({"category": cat, "index": round(fit[msa] / fit.mean() * 100)})
    return pd.DataFrame(rows).sort_values("index", ascending=False).reset_index(drop=True)


def affinities_from_npos(table: pd.DataFrame, normalize: str = "max") -> dict:
    """Convert an NPOS persona x category cross-tab into an affinity library.

    ``table`` has the 7 segments on one axis and product categories on the other;
    values are purchase incidence (% of segment buying), average spend, or an
    index vs national -- any of these work. Each category is normalized so its
    strongest-buying persona = 1.0, giving relative affinities the scorer uses.
    """
    from . import appa_loader
    t = table.copy()
    segs = set(appa_loader.SEGMENTS)
    if not (segs & set(map(str, t.index))) and (segs & set(map(str, t.columns))):
        t = t.T  # personas were columns -> make them rows
    t = t.apply(pd.to_numeric, errors="coerce").fillna(0.0)
    lib = {}
    for cat in t.columns:
        col = t[cat]
        w = col / (col.max() or 1.0) if normalize == "max" else col
        lib[str(cat)] = {str(p): round(float(v), 3) for p, v in w.items() if v > 0}
    return lib


def load_affinities(path) -> dict:
    """Read an NPOS persona x category file (CSV/XLSX, personas in first column)."""
    from pathlib import Path
    p = Path(path)
    df = pd.read_excel(p, index_col=0) if p.suffix.lower() in {".xlsx", ".xls"} else pd.read_csv(p, index_col=0)
    return affinities_from_npos(df)


__all__ = ["CATEGORY_AFFINITY", "FORMAT_AFFINITY", "msa_persona_mix", "market_fit",
           "assortment_index", "affinities_from_npos", "load_affinities"]
