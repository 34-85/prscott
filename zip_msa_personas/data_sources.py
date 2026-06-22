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
    """ZIP->CBSA crosswalk + CBSA metadata.

    Primary source is the Census ZCTA->county relationship file joined to the OMB
    CBSA delineation (county->CBSA + Metro/Micro), both on www2.census.gov -- which
    serves through the allowlist and isn't bot-blocked like HUD. Falls back to the
    HUD crosswalk + OMB delineation if the Census path is unavailable.
    """
    try:
        return load_zcta_cbsa_reference()
    except Exception as census_err:  # noqa: BLE001
        try:
            return ReferenceData(load_zip_cbsa_crosswalk(), load_cbsa_metadata())
        except Exception as hud_err:  # noqa: BLE001
            raise DataUnavailable(
                f"No ZIP->CBSA source reachable. Census ZCTA->county->CBSA: {census_err}; "
                f"HUD: {hud_err}"
            )


# Census ZCTA->county relationship file (2020 geography). The Bureau publishes no
# direct ZCTA->CBSA file, so we go ZCTA -> county (this file) -> CBSA (the OMB
# delineation, county-level). One row per ZCTA-county part, with the land area of
# the part for dominant assignment.
ZCTA_COUNTY_REL_URL = os.environ.get(
    "ZMP_ZCTA_COUNTY_URL",
    "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/"
    "tab20_zcta520_county20_natl.txt",
)


def _find_col(cols, *must_contain):
    up = {c.upper(): c for c in cols}
    for u, orig in up.items():
        if all(tok in u for tok in must_contain):
            return orig
    return None


def load_county_cbsa_delineation() -> pd.DataFrame:
    """County FIPS -> CBSA code, title, Metro flag (OMB delineation, list1)."""
    path = _download(CBSA_DELINEATION_URL, CACHE_DIR / "cbsa_delineation.xlsx")
    df = pd.read_excel(path, skiprows=2, dtype=str)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    code_col = next(c for c in df.columns if "cbsa_code" in c)
    title_col = next(c for c in df.columns if "cbsa_title" in c)
    type_col = next(c for c in df.columns if "metropolitan/micropolitan" in c or "type" in c)
    st_col = next(c for c in df.columns if "fips_state" in c)
    cty_col = next(c for c in df.columns if "fips_county" in c)
    out = df.dropna(subset=[code_col, st_col, cty_col]).copy()
    out["county"] = out[st_col].str.zfill(2) + out[cty_col].str.zfill(3)
    out["cbsa"] = out[code_col].str.strip()
    out["cbsa_title"] = out[title_col].str.strip()
    out["metro"] = out[type_col].str.contains("Metropolitan", case=False, na=False)
    return out[["county", "cbsa", "cbsa_title", "metro"]].drop_duplicates("county")


def load_zcta_cbsa_reference(url: str | None = None, delineation: pd.DataFrame | None = None) -> ReferenceData:
    """Build ReferenceData via ZCTA -> county (relationship file) -> CBSA (OMB).

    ``delineation`` (county, cbsa, cbsa_title, metro) defaults to the live OMB
    delineation; pass one to build offline / in tests.
    """
    url = url or ZCTA_COUNTY_REL_URL
    # Accept a local file path (testing / user-provided) or a URL to download.
    if str(url).startswith(("http://", "https://")):
        path = _download(url, CACHE_DIR / "zcta_county_rel.txt")
    else:
        path = Path(url)
    # Delimiter varies by vintage (pipe/comma/tab); pick the one that splits the
    # header into the most fields (csv.Sniffer is unreliable on these files).
    header = Path(path).read_text(errors="replace").split("\n", 1)[0]
    sep = max(["|", ",", "\t", ";"], key=header.count)
    rel = pd.read_csv(path, sep=sep, dtype=str)
    zcta_col = _find_col(rel.columns, "GEOID", "ZCTA5")
    county_col = _find_col(rel.columns, "GEOID", "COUNTY")
    area_col = _find_col(rel.columns, "AREALAND", "PART")
    if not (zcta_col and county_col):
        raise DataUnavailable(
            f"ZCTA->county relationship columns not recognized: {list(rel.columns)[:12]}..."
        )
    z2c = pd.DataFrame({
        "zip": rel[zcta_col].astype(str).str.extract(r"(\d{1,5})")[0].str.zfill(5),
        "county": rel[county_col].astype(str).str.extract(r"(\d{1,5})")[0].str.zfill(5),
        "area": pd.to_numeric(rel[area_col], errors="coerce").fillna(0.0) if area_col else 1.0,
    }).dropna(subset=["zip", "county"])

    delin = load_county_cbsa_delineation() if delineation is None else delineation
    joined = z2c.merge(delin[["county", "cbsa"]], on="county", how="inner")
    # Land area of each (ZCTA, CBSA) overlap -> share of the ZCTA for dominant assign.
    agg = joined.groupby(["zip", "cbsa"], as_index=False)["area"].sum()
    tot = agg.groupby("zip")["area"].transform("sum").replace(0, 1.0)
    agg["res_ratio"] = agg["area"] / tot
    zip_cbsa = agg[["zip", "cbsa", "res_ratio"]].copy()

    meta = delin[["cbsa", "cbsa_title", "metro"]].drop_duplicates("cbsa").reset_index(drop=True)
    return ReferenceData(zip_cbsa=zip_cbsa, cbsa_meta=meta)


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
    key = os.environ.get("CENSUS_API_KEY")
    if key:
        url += f"&key={key}"
    cache = CACHE_DIR / f"acs_zcta_{year}.parquet"
    if cache.exists():
        return pd.read_parquet(cache)
    resp = requests.get(url, headers=_HEADERS, timeout=120)
    if resp.status_code != 200:
        raise DataUnavailable(f"ACS fetch failed (HTTP {resp.status_code}) at {url}")
    # A keyless/invalid-key request returns HTTP 200 + an HTML "Missing Key" page,
    # not JSON. Detect it so the failure is actionable rather than a decode error.
    if "json" not in resp.headers.get("content-type", "").lower():
        snippet = " ".join(resp.text.split())[:160]
        hint = (
            "set CENSUS_API_KEY (free: https://api.census.gov/data/key_signup.html)"
            if not key else "verify the CENSUS_API_KEY value"
        )
        raise DataUnavailable(f"ACS API did not return JSON -- {hint}. Response began: {snippet!r}")
    rows = resp.json()
    df = pd.DataFrame(rows[1:], columns=rows[0])
    df = df.rename(columns={**ACS_VARIABLES, "zip code tabulation area": "zip"})
    for col in ACS_VARIABLES.values():
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["zip"] = df["zip"].str.zfill(5)
    df.to_parquet(cache)
    return df


# ---- ZIP -> DMA (Nielsen market) crosswalk --------------------------------

# DMA boundaries are Nielsen IP, so there is no public-domain source like HUD's.
# Commercial users supply their licensed crosswalk file (CSV/XLSX) via
# --zip-dma / ZMP_ZIP_DMA_FILE; an optional URL (ZMP_ZIP_DMA_URL) is supported
# for self-hosted copies. Confirm your Nielsen license permits redistributing
# DMA assignments before including them in a deliverable (see rights.py).
ZIP_DMA_URL = os.environ.get("ZMP_ZIP_DMA_URL")

_ZIP_ALIASES = {"zip", "zipcode", "zip_code", "postal", "postalcode", "postal_code"}
_DMA_CODE_ALIASES = {"dma", "dma_code", "dmacode", "market", "market_code", "dma_no", "dma_number"}
_DMA_NAME_ALIASES = {"dma_name", "dmaname", "market_name", "name", "dma_description"}


def _read_table(source: str | Path) -> pd.DataFrame:
    src = str(source)
    if src.startswith(("http://", "https://")):
        dest = CACHE_DIR / f"zip_dma_{abs(hash(src)) % 10**8}{Path(src).suffix or '.csv'}"
        _download(src, dest)
        source = dest
    p = Path(source)
    if p.suffix.lower() in {".xlsx", ".xls"}:
        return pd.read_excel(p, dtype=str)
    return pd.read_csv(p, dtype=str)


def load_zip_dma_crosswalk(source: str | Path | None = None) -> pd.DataFrame:
    """ZIP -> Nielsen DMA crosswalk, normalized to: zip, dma_code, dma_name.

    Source resolution order: explicit ``source`` arg, ``ZMP_ZIP_DMA_FILE`` env,
    then ``ZMP_ZIP_DMA_URL`` env. The mapping is Nielsen-derived -- use your
    licensed copy.
    """
    source = source or os.environ.get("ZMP_ZIP_DMA_FILE") or ZIP_DMA_URL
    if not source:
        raise DataUnavailable(
            "No ZIP->DMA crosswalk configured. Provide a licensed crosswalk file "
            "(--zip-dma / ZMP_ZIP_DMA_FILE) or set ZMP_ZIP_DMA_URL."
        )
    df = _read_table(source)
    cols = {c.strip().lower().replace(" ", "").replace("_", ""): c for c in df.columns}

    def _find(aliases):
        norm = {a.replace("_", "") for a in aliases}
        for key, orig in cols.items():
            if key in norm:
                return orig
        return None

    zip_col = _find(_ZIP_ALIASES)
    code_col = _find(_DMA_CODE_ALIASES)
    name_col = _find(_DMA_NAME_ALIASES)
    if zip_col is None or code_col is None:
        raise ValueError(
            f"ZIP->DMA crosswalk must have a zip and a DMA code column; saw {list(df.columns)}."
        )
    out = pd.DataFrame(
        {
            "zip": df[zip_col].astype(str).str.extract(r"(\d{1,5})")[0].str.zfill(5),
            "dma_code": df[code_col].astype(str).str.extract(r"(\d+)")[0],
            "dma_name": df[name_col].astype(str).str.strip() if name_col else pd.NA,
        }
    )
    return out.dropna(subset=["zip", "dma_code"]).reset_index(drop=True)


__all__ = [
    "ReferenceData",
    "DataUnavailable",
    "load_reference_data",
    "load_zip_cbsa_crosswalk",
    "load_cbsa_metadata",
    "load_acs_zcta_features",
    "load_zip_dma_crosswalk",
    "ACS_VARIABLES",
]
