"""One command -> the full deliverable kit from the scored national dataset.

Takes the official run's outputs (enriched ZIPs + per-ZIP distributions), joins
public ZIP geography (city/state/lat-lon, for labels + maps), and produces the
business-ready files: the Excel workbook, the US persona maps, and the per-persona
one-pagers. No bespoke scripting per run.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from . import appa_loader, maps, onepager, propensity, query, reporting
from .data_sources import CACHE_DIR, _download

# Public ZIP geography (GeoNames mirror on GitHub -- allowlisted). Used only for
# labels and map coordinates; the persona data itself is from ACS + the survey.
GEONAMES_URL = "https://raw.githubusercontent.com/symerio/postal-codes-data/master/data/geonames/US.txt"
_GEO_COLS = ["country", "zip", "city", "state", "state_code", "county", "c2", "a3", "c3", "lat", "lon", "acc"]


def load_geography(url: str | None = None) -> pd.DataFrame:
    path = _download(url or GEONAMES_URL, CACHE_DIR / "geonames_us.txt")
    g = pd.read_csv(path, sep="\t", header=None, names=_GEO_COLS, dtype=str)
    g = g[g["zip"].str.match(r"^\d{5}$", na=False)].drop_duplicates("zip").copy()
    for c in ("lat", "lon"):
        g[c] = pd.to_numeric(g[c], errors="coerce")
    return g[["zip", "city", "state", "lat", "lon"]].dropna(subset=["lat", "lon"])


def build_deliverables(enriched: pd.DataFrame, distributions: pd.DataFrame, outdir: str | Path,
                       geo: pd.DataFrame | None = None, is_preview: bool = False) -> Path:
    """Generate the workbook, maps, and one-pagers into ``outdir``."""
    out = Path(outdir); (out / "maps").mkdir(parents=True, exist_ok=True)
    (out / "onepagers").mkdir(parents=True, exist_ok=True)
    segs = appa_loader.SEGMENTS
    geo = load_geography() if geo is None else geo

    wide = (distributions.assign(zip=distributions["zip"].astype(str).str.zfill(5))
            .pivot_table(index="zip", columns="persona", values="share", fill_value=0.0)
            .reindex(columns=segs, fill_value=0.0))
    e = enriched.copy(); e["zip"] = e["zip"].astype(str).str.zfill(5)
    g = geo.set_index("zip")

    # --- Workbook ---
    z = wide.reset_index()
    z.insert(1, "City", g["city"].reindex(z["zip"]).values)
    z.insert(2, "State", g["state"].reindex(z["zip"]).values)
    a = e.set_index("zip")
    basis = {"survey_anchored": "Survey data (your NPOS)", "demographic_model": "Estimated (demographics)",
             "observed": "Survey data (your NPOS)", "imputed_similar": "Estimated (similar ZIPs)",
             "extrapolated_baseline": "Estimated (broad)"}
    z.insert(3, "Top persona", a["persona"].reindex(z["zip"]).values)
    z.insert(4, "Confidence", pd.to_numeric(a["confidence"], errors="coerce").reindex(z["zip"]).round(3).values)
    z.insert(5, "Basis", a["provenance"].map(basis).reindex(z["zip"]).values)
    z = z.rename(columns={"zip": "ZIP"})
    reporting.build_workbook(z, segs, out / "APPA_personas_workbook.xlsx", is_preview=is_preview)

    # --- Maps + one-pagers ---
    import re
    m = g[["lat", "lon"]].join(wide, how="inner")
    m["Top persona"] = a["persona"]
    natl = wide.mean(axis=0)
    maps.dominant_persona_map(m.reset_index(), "Top persona", out / "maps" / "00_dominant_persona.png")
    fp = propensity.load_fingerprints()
    desc = onepager.load_descriptions(propensity.DEFAULT_FINGERPRINTS.parent / "persona_descriptions.json")
    for i, s in enumerate(segs, 1):
        m[f"{s}_idx"] = m[s] / natl[s] * 100
        mp = out / "maps" / f"{i:02d}_{re.sub(r'[^A-Za-z]+', '_', s)}_index.png"
        maps.index_map(m, f"{s}_idx", mp, title=f"{s} — index vs US average (100=avg)")
        # Real top markets (MSAs over-indexing on this persona) for the one-pager.
        try:
            tm = query.top_markets_for_persona(e.reset_index() if e.index.name == "zip" else e,
                                               distributions, s, "msa_title", n=8,
                                               base_rate=float(natl[s])).rename(columns={"msa_title": "geo"})
        except Exception:  # noqa: BLE001
            tm = None
        onepager.build_persona_onepager(s, fp, desc, mp, tm,
                                        out / "onepagers" / f"{re.sub(r'[^A-Za-z]+','_',s)}.png",
                                        is_preview=is_preview)
    return out


__all__ = ["build_deliverables", "load_geography"]
