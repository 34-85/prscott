"""ACS -> demographic-fraction transformer (the glue for the propensity model).

The propensity model (``propensity.score_demographics``) consumes per-ZIP
*fractions* in four variables -- age (generation), income tier, race/ethnicity,
marital status. The Census ACS ships these as many raw count columns across
several tables. This module rolls those raw counts up into the propensity
categories and normalizes within each variable.

The *rollup logic* here is the real, tested IP. The exact ACS variable codes to
fetch live in ``ACS_PULL_SPEC`` as documented config; they are validated against
the live API on the first official run (when census.gov is reachable).
"""
from __future__ import annotations

import os

import pandas as pd

# --- semantic rollups (over friendly fine-category names) --------------------

# Age band (ACS B01001, both sexes) -> generation, by band midpoint, adults 18+.
# Generations referenced to ~2024: Gen Z 18-27, Millennial 28-43, Gen X 44-59,
# Boomer 60+.
GENERATION_FROM_AGE_BAND = {
    "18_19": "genz", "20": "genz", "21": "genz", "22_24": "genz", "25_29": "millennial",
    "30_34": "millennial", "35_39": "millennial", "40_44": "millennial",
    "45_49": "genx", "50_54": "genx", "55_59": "genx",
    "60_61": "boomer", "62_64": "boomer", "65_66": "boomer", "67_69": "boomer",
    "70_74": "boomer", "75_79": "boomer", "80_84": "boomer", "85_plus": "boomer",
}

# Household income bracket (ACS B19001) -> tier.
INCOME_TIER = {
    "lt_10k": "low", "10_15k": "low", "15_20k": "low", "20_25k": "low", "25_30k": "low",
    "30_35k": "low", "35_40k": "low", "40_45k": "low", "45_50k": "low",
    "50_60k": "mid", "60_75k": "mid", "75_100k": "mid",
    "100_125k": "high", "125_150k": "high", "150_200k": "high", "200k_plus": "high",
}

# Race / ethnicity (ACS B02001 + Hispanic origin B03003). Overlapping by design
# (Hispanic is an ethnicity); the propensity model normalizes within the variable.
RACE_CATEGORIES = {"white": "white", "black": "black", "asian": "asian", "hispanic": "hispanic"}

# Marital status (ACS B12001, both sexes, 15+).
MARITAL_MAP = {
    "never_married": "never_married",
    "now_married": "married",
    "widowed": "formerly_married", "divorced": "formerly_married", "separated": "formerly_married",
}

# var -> {coarse_category: [fine_category names that roll into it]}
def _invert(mapping: dict) -> dict:
    out: dict = {}
    for fine, coarse in mapping.items():
        out.setdefault(coarse, []).append(fine)
    return out


ACS_BUCKETS = {
    "age": _invert(GENERATION_FROM_AGE_BAND),
    "income": _invert(INCOME_TIER),
    "race": _invert(RACE_CATEGORIES),
    "marital": _invert(MARITAL_MAP),
}

# Documented ACS source tables for the live fetch (codes validated on first run).
ACS_PULL_SPEC = {
    "age": "B01001 (Sex by Age) -> sum both sexes per band, map band->generation",
    "income": "B19001 (Household Income) -> bracket->tier (low<50k, mid 50-100k, high>100k)",
    "race": "B02001 (Race: White/Black/Asian alone) + B03003 (Hispanic) over total population",
    "marital": "B12001 (Sex by Marital Status, 15+) -> never / now-married / widowed+divorced+separated",
}


def fractions_from_counts(counts: pd.DataFrame, buckets: dict = ACS_BUCKETS) -> pd.DataFrame:
    """Roll fine-category counts up into propensity ``<var>_<category>`` fractions.

    ``counts`` is indexed by zip; its columns are the fine categories named in the
    rollup maps above (e.g. ``25_29``, ``75_100k``, ``white``, ``now_married``).
    Output columns are normalized to sum to 1 within each variable.
    """
    out = pd.DataFrame(index=counts.index)
    for var, cats in buckets.items():
        coarse = {}
        for cat, fines in cats.items():
            cols = [c for c in fines if c in counts.columns]
            coarse[cat] = counts[cols].sum(axis=1) if cols else 0.0
        block = pd.DataFrame(coarse, index=counts.index)
        totals = block.sum(axis=1).replace(0, 1.0)
        for cat in block.columns:
            out[f"{var}_{cat}"] = block[cat] / totals
    return out


# --- live ACS fetch (validated against the API on first official run) --------

# B01001 Sex by Age: (male var, female var, band). Both sexes summed per band.
_AGE_PAIRS = [
    ("007", "031", "18_19"), ("008", "032", "20"), ("009", "033", "21"),
    ("010", "034", "22_24"), ("011", "035", "25_29"), ("012", "036", "30_34"),
    ("013", "037", "35_39"), ("014", "038", "40_44"), ("015", "039", "45_49"),
    ("016", "040", "50_54"), ("017", "041", "55_59"), ("018", "042", "60_61"),
    ("019", "043", "62_64"), ("020", "044", "65_66"), ("021", "045", "67_69"),
    ("022", "046", "70_74"), ("023", "047", "75_79"), ("024", "048", "80_84"),
    ("025", "049", "85_plus"),
]
# B19001 Household Income brackets _002.._017 -> fine names.
_INCOME_VARS = dict(zip(
    [f"{i:03d}" for i in range(2, 18)],
    ["lt_10k", "10_15k", "15_20k", "20_25k", "25_30k", "30_35k", "35_40k", "40_45k",
     "45_50k", "50_60k", "60_75k", "75_100k", "100_125k", "125_150k", "150_200k", "200k_plus"],
))
# B12001 Sex by Marital Status -> fine names (summed male+female).
_MARITAL_PAIRS = {
    "never_married": [("B12001", "003"), ("B12001", "012")],
    "now_married": [("B12001", "004"), ("B12001", "013")],
    "widowed": [("B12001", "009"), ("B12001", "018")],
    "divorced": [("B12001", "010"), ("B12001", "019")],
    "separated": [("B12001", "007"), ("B12001", "016")],
}


def fetch_acs_demographics(year: int = 2022) -> pd.DataFrame:
    """Pull the ACS tables and return per-ZCTA fine-category counts.

    Output columns are the fine names used by ``fractions_from_counts``. Network
    fetch -- needs census.gov reachable. Variable codes are standard ACS5; the
    first live run is the validation point.
    """
    import requests
    base = f"https://api.census.gov/data/{year}/acs/acs5"
    headers = {"User-Agent": "zip-msa-personas/1.0"}
    key = os.environ.get("CENSUS_API_KEY")

    def _get(varcodes):
        get = ",".join(varcodes)
        url = f"{base}?get={get}&for=zip%20code%20tabulation%20area:*"
        if key:
            url += f"&key={key}"
        r = requests.get(url, headers=headers, timeout=120)
        r.raise_for_status()
        rows = r.json()
        df = pd.DataFrame(rows[1:], columns=rows[0])
        df = df.rename(columns={"zip code tabulation area": "zip"})
        for c in varcodes:
            df[c] = pd.to_numeric(df[c], errors="coerce")
        return df.set_index("zip")

    out = pd.DataFrame()

    age = _get([f"B01001_{m}E" for m, _, _ in _AGE_PAIRS] + [f"B01001_{f}E" for _, f, _ in _AGE_PAIRS])
    for m, f, band in _AGE_PAIRS:
        out[band] = age[f"B01001_{m}E"] + age[f"B01001_{f}E"]

    inc = _get([f"B19001_{c}E" for c in _INCOME_VARS])
    for c, name in _INCOME_VARS.items():
        out[name] = inc[f"B19001_{c}E"]

    race = _get(["B02001_002E", "B02001_003E", "B02001_005E", "B03003_003E"])
    out["white"] = race["B02001_002E"]; out["black"] = race["B02001_003E"]
    out["asian"] = race["B02001_005E"]; out["hispanic"] = race["B03003_003E"]

    mar_codes = sorted({f"{t}_{c}E" for pairs in _MARITAL_PAIRS.values() for t, c in pairs})
    mar = _get(mar_codes)
    for name, pairs in _MARITAL_PAIRS.items():
        out[name] = sum(mar[f"{t}_{c}E"] for t, c in pairs)

    out.index = out.index.astype(str).str.zfill(5)
    return out


def demographic_mix(year: int = 2022):
    """Convenience: fetch ACS -> fractions -> propensity persona mix per ZIP."""
    from . import propensity
    fracs = fractions_from_counts(fetch_acs_demographics(year))
    return propensity.score_demographics(fracs)


__all__ = [
    "fractions_from_counts", "fetch_acs_demographics", "demographic_mix",
    "ACS_BUCKETS", "ACS_PULL_SPEC", "GENERATION_FROM_AGE_BAND", "INCOME_TIER", "MARITAL_MAP",
]
