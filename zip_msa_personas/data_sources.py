"""Authoritative reference data for the ZIP -> MSA -> persona pipeline.

This module is the *only* place that reaches out to the network. Everything is
fetched from official, public-domain U.S. government sources and cached on disk
so the rest of the pipeline is deterministic and offline-friendly.

Sources
-------
* HUD USPS ZIP -> CBSA crosswalk (quarterly, address-ratio weighted):
    https://www.huduser.gov/portal/datasets/usps_crosswalk.html
  This handles the ZIP-vs-ZCTA mismatch and gives the address share of each ZIP
  that falls in each CBSA -- exactly what "dominant assign" needs.
* OMB / Census CBSA delineation file (which CBSAs are *Metropolitan* vs
  *Micropolitan*, and the county membership):
    https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/delineation-files.html
* Census ACS 5-year ZCTA tables (demographic features for similarity):
    https://api.census.gov/data/2022/acs/acs5

Network note
------------
Some managed/sandboxed environments allow only an allowlist of hosts. If
``census.gov`` / ``huduser.gov`` are not allowlisted, the live fetches below
will fail; run the pipeline locally or add those hosts to the egress policy.
The pipeline still runs fully against a provided crosswalk/feature file or the
bundled demo fixture -- see ``pipeline.py`` and ``cli.py``.
"""
from __future__ import annotations

import io
import os
import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import requests

CACHE_DIR = Path(os.environ.get("ZMP_CACHE", Path(__file__).resolve().parent.parent / "data" / "cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Pin to a known-good vintage; override via env if you need a fresher release.
HUD_ZIP_CBSA_URL = os.environ.get(
    "ZMP_HUD_URL",
    "https://www.huduser.gov/portal/datasets/usps/ZIP_CBSA_122023.xlsx",
)
CBSA_DELINEATION_URL = os.environ.get(
    "ZMP_DELINEATION_URL",
    "https://www2.census.gov/programs-surveys/metro-micro/geographies/"
    "reference-files/2023/delineation-files/list1_2023.xlsx",
)

_HEADERS = {"User-Agent": "zip-msa-personas/1.0 (+https://github.com/34-85/prscott)"}


class DataUnavailable(RuntimeError):
    """Raised when an authoritative source cannot be reached and no cache exists."""


def _download(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    resp = requests.get(url, headers=_HEADERS, timeout=60)
    if resp.status_code != 200:
        raise DataUnavailable(
            f"Could not fetch {url} (HTTP {resp.status_code}). "
            "If you are in a sandboxed environment, allowlist the host or run locally."
        )
    dest.write_bytes(resp.content)
    return dest


@dataclass
class ReferenceData:
    """Bundle of the reference frames the pipeline needs."""

    zip_cbsa: pd.DataFrame  # columns: zip, cbsa, res_ratio
    cbsa_meta: pd.DataFrame  # columns: cbsa, cbsa_title, metro (bool)


def load_zip_cbsa_crosswalk() -> pd.DataFrame:
    """ZIP -> CBSA with the residential address ratio (the dominant-assign weight)."""
    path = _download(HUD_ZIP_CBSA_URL, CACHE_DIR / "hud_zip_cbsa.xlsx")
    df = pd.read_excel(path, dtype={"ZIP": str, "CBSA": str})
    df.columns = [c.strip().lower() for c in df.columns]
    out = df.rename(columns={"res_ratio": "res_ratio"})[["zip", "cbsa", "res_ratio"]].copy()
    out["zip"] = out["zip"].str.zfill(5)
    out["cbsa"] = out["cbsa"].str.strip()
    # HUD encodes "not in a CBSA" as 99999.
    out = out[out["cbsa"] != "99999"]
    return out


def load_cbsa_metadata() -> pd.DataFrame:
    """CBSA code -> title and Metropolitan/Micropolitan flag (OMB delineation)."""
    path = _download(CBSA_DELINEATION_URL, CACHE_DIR / "cbsa_delineation.xlsx")
    # The delineation file has a few header rows before the table.
    df = pd.read_excel(path, skiprows=2, dtype=str)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    code_col = next(c for c in df.columns if "cbsa_code" in c)
    title_col = next(c for c in df.columns if "cbsa_title" in c)
    type_col = next(c for c in df.columns if "metropolitan/micropolitan" in c or "type" in c)
    meta = (
        df[[code_col, title_col, type_col]]
        .dropna(subset=[code_col])
        .drop_duplicates(subset=[code_col])
        .rename(columns={code_col: "cbsa", title_col: "cbsa_title", type_col: "cbsa_type"})
    )
    meta["metro"] = meta["cbsa_type"].str.contains("Metropolitan", case=False, na=False)
    return meta[["cbsa", "cbsa_title", "metro"]]


def load_reference_data() -> ReferenceData:
    return ReferenceData(load_zip_cbsa_crosswalk(), load_cbsa_metadata())


# ---- Demographic features (ACS) --------------------------------------------

# A compact, interpretable feature set. Extend freely -- everything downstream
# just consumes a numeric ZCTA-by-feature matrix.
ACS_VARIABLES = {
    "B01003_001E": "population",
    "B19013_001E": "median_household_income",
    "B01002_001E": "median_age",
    "B25077_001E": "median_home_value",
    "B15003_022E": "bachelors_count",
    "B23025_005E": "unemployed_count",
    "B25003_003E": "renter_occupied",
    "B11001_001E": "households",
}


def load_acs_zcta_features(year: int = 2022) -> pd.DataFrame:
    """Per-ZCTA demographic features used for similarity-based imputation."""
    base = f"https://api.census.gov/data/{year}/acs/acs5"
    get = ",".join(ACS_VARIABLES.keys())
    url = f"{base}?get={get}&for=zip%20code%20tabulation%20area:*"
    cache = CACHE_DIR / f"acs_zcta_{year}.parquet"
    if cache.exists():
        return pd.read_parquet(cache)
    resp = requests.get(url, headers=_HEADERS, timeout=120)
    if resp.status_code != 200:
        raise DataUnavailable(f"ACS fetch failed (HTTP {resp.status_code}) at {url}")
    rows = resp.json()
    df = pd.DataFrame(rows[1:], columns=rows[0])
    df = df.rename(columns={**ACS_VARIABLES, "zip code tabulation area": "zip"})
    for col in ACS_VARIABLES.values():
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["zip"] = df["zip"].str.zfill(5)
    df.to_parquet(cache)
    return df


__all__ = [
    "ReferenceData",
    "DataUnavailable",
    "load_reference_data",
    "load_zip_cbsa_crosswalk",
    "load_cbsa_metadata",
    "load_acs_zcta_features",
    "ACS_VARIABLES",
]
