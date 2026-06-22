"""Loader for the APPA NPOS segmentation workbook (ZIP and DMA sheets).

The survey export is a wide, survey-weighted matrix (not tidy). Each sheet has,
near the top, a row of segment names with a Count/% pair beneath each, a
"Weighted base" row, then the data. The geography label (ZIP or DMA) sits in the
column immediately left of the first segment column.

We locate the segment block by scanning for the segment-name row (robust to the
small layout differences between the ZIP and DMA sheets), then melt the weighted
**Count** cells into tidy ``(label, persona, weight)`` rows. The '%' columns are
segment-wise (not row-wise) and are ignored.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

SEGMENTS = [
    "Comfort Companions", "Prudent Pragmatists", "Passionate Parents",
    "Ambitious Go-Getters", "Security Seekers", "Adventure Seekers",
    "Well-being Warriors",
]
_SEG_SET = set(SEGMENTS)
_NON_DATA_LABELS = {"sum", "weighted base", "", "nan"}


def _find_segment_row(raw: pd.DataFrame, scan: int = 12) -> int:
    for r in range(min(scan, len(raw))):
        hits = sum(str(v).strip() in _SEG_SET for v in raw.iloc[r])
        if hits >= 4:
            return r
    raise ValueError("Could not locate the segment-name header row in the sheet.")


def parse_segment_sheet(path: str | Path, sheet: str) -> pd.DataFrame:
    """Generic parser -> tidy rows: label, persona, weight (weight>0 only)."""
    raw = pd.read_excel(path, sheet_name=sheet, header=None)
    name_row = _find_segment_row(raw)
    seg_cols = {str(v).strip(): c for c, v in raw.iloc[name_row].items() if str(v).strip() in _SEG_SET}
    if set(seg_cols) != _SEG_SET:
        raise ValueError(f"Missing segments in '{sheet}': {sorted(_SEG_SET - set(seg_cols))}")
    label_col = min(seg_cols.values()) - 1
    first_data = name_row + 3  # name row, Count/% row, weighted-base row, then data

    data = raw.iloc[first_data:].copy()
    label = data[label_col].astype(str).str.strip()
    keep = ~label.str.lower().isin(_NON_DATA_LABELS)
    data, label = data[keep], label[keep]

    records = []
    for seg, col in seg_cols.items():
        w = pd.to_numeric(data[col], errors="coerce").fillna(0.0)
        block = pd.DataFrame({"label": label.values, "persona": seg, "weight": w.values})
        records.append(block[block["weight"] > 0])
    return pd.concat(records, ignore_index=True)


def load_appa_segmentation(path: str | Path, sheet: str = "ZIPS BY STATE") -> pd.DataFrame:
    """Tidy ZIP-level rows: zip, persona, weight (weight>0 only)."""
    tidy = parse_segment_sheet(path, sheet)
    zip_str = tidy["label"].str.extract(r"(\d{1,5})")[0]
    tidy = tidy[zip_str.notna()].copy()
    tidy["zip"] = zip_str[zip_str.notna()].str.zfill(5)
    out = tidy.groupby(["zip", "persona"], as_index=False)["weight"].sum()
    return out.sort_values(["zip", "persona"]).reset_index(drop=True)


def load_appa_dma(path: str | Path, sheet: str = "DMA") -> pd.DataFrame:
    """Tidy DMA-level rows: dma, persona, weight -- the statistically robust prior."""
    tidy = parse_segment_sheet(path, sheet).rename(columns={"label": "dma"})
    out = tidy.groupby(["dma", "persona"], as_index=False)["weight"].sum()
    return out.sort_values(["dma", "persona"]).reset_index(drop=True)


def summarize(long: pd.DataFrame, unit: str = "zip") -> str:
    n = long[unit].nunique()
    by_seg = long.groupby("persona")["weight"].sum().sort_values(ascending=False)
    lines = [f"Observed {unit}s with segmentation: {n:,}",
             f"Total ({unit}, segment) cells: {len(long):,}",
             "Weighted respondents by segment:"]
    for seg, w in by_seg.items():
        lines.append(f"  {seg:<22} {w:10.1f}")
    return "\n".join(lines)


__all__ = ["load_appa_segmentation", "load_appa_dma", "parse_segment_sheet", "summarize", "SEGMENTS"]
