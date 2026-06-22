"""Loader for the APPA NPOS 'ZIP codes by segment' workbook.

The survey export is a wide, survey-weighted matrix (not tidy):

    row 3: segment names every other column (Comfort Companions, ...)
    row 4: Count / % subheaders under each segment
    col 1: state (sparse, forward-filled)
    col 2: 5-digit ZIP
    data : weighted respondent Count per (ZIP, segment), plus a trailing SUM row

This module converts it into the tidy ``(zip, persona, weight)`` long form the
pipeline consumes, using the weighted **Count** as the persona weight (so a
ZIP's per-segment shares are the survey-weighted composition of its pet owners).
The redundant '%' columns (segment-wise, not ZIP-wise) are ignored.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

SEGMENT_HEADER_ROW = 3   # row with segment names
SUBHEADER_ROW = 4        # row with Count/% labels
FIRST_DATA_ROW = 6       # first ZIP row
STATE_COL = 1
ZIP_COL = 2

SEGMENTS = [
    "Comfort Companions", "Prudent Pragmatists", "Passionate Parents",
    "Ambitious Go-Getters", "Security Seekers", "Adventure Seekers",
    "Well-being Warriors",
]


def _segment_count_columns(raw: pd.DataFrame) -> dict[str, int]:
    """Map each segment name -> its Count column index (name col; % is name+1)."""
    header = raw.iloc[SEGMENT_HEADER_ROW]
    mapping = {}
    for col, val in header.items():
        name = str(val).strip()
        if name in SEGMENTS:
            mapping[name] = col
    missing = set(SEGMENTS) - set(mapping)
    if missing:
        raise ValueError(f"Segment columns not found in workbook: {sorted(missing)}")
    return mapping


def load_appa_segmentation(path: str | Path, sheet: str = "ZIPS BY STATE") -> pd.DataFrame:
    """Return tidy long rows: zip, persona, weight, state (weight>0 only)."""
    raw = pd.read_excel(path, sheet_name=sheet, header=None)
    seg_cols = _segment_count_columns(raw)

    data = raw.iloc[FIRST_DATA_ROW:].copy()
    # Drop the trailing SUM / non-ZIP rows.
    zip_str = data[ZIP_COL].astype(str).str.extract(r"(\d{1,5})")[0]
    data = data[zip_str.notna()].copy()
    data["zip"] = zip_str[zip_str.notna()].str.zfill(5)
    data["state"] = data[STATE_COL].ffill()

    records = []
    for seg, col in seg_cols.items():
        w = pd.to_numeric(data[col], errors="coerce").fillna(0.0)
        block = pd.DataFrame({"zip": data["zip"], "state": data["state"], "persona": seg, "weight": w})
        records.append(block[block["weight"] > 0])
    long = pd.concat(records, ignore_index=True)
    # Collapse any duplicate ZIP rows (defensive) and sort.
    long = long.groupby(["zip", "state", "persona"], as_index=False)["weight"].sum()
    return long.sort_values(["zip", "persona"]).reset_index(drop=True)


def summarize(long: pd.DataFrame) -> str:
    n_zips = long["zip"].nunique()
    by_seg = long.groupby("persona")["weight"].sum().sort_values(ascending=False)
    lines = [f"Observed ZIPs with segmentation: {n_zips:,}",
             f"Total (zip, segment) cells: {len(long):,}",
             "Weighted respondents by segment:"]
    for seg, w in by_seg.items():
        lines.append(f"  {seg:<22} {w:10.1f}")
    return "\n".join(lines)


__all__ = ["load_appa_segmentation", "summarize", "SEGMENTS"]
