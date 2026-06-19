"""Data-rights tagging so licensed sources never leak into sellable output.

The business depends on a clean separation:

* RESELLABLE  -- first-party (your pet-owner segmentation), public-domain
                 (Census/HUD), and *derived* products built from data you're
                 licensed to use commercially (e.g. personas informed by APPA).
* INTERNAL    -- licensed third-party data used only for validation/confirmation
                 (e.g. Experian Mosaic). Redistribution of these or their
                 derivatives generally requires a separate syndication license.

Every output field is mapped to a source; ``export_deliverable`` drops anything
non-resellable by default and emits a manifest documenting exactly what was
included and excluded. Restricted data is excluded *by construction*, not by
remembering to.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import pandas as pd

RESELLABLE = "resellable"
INTERNAL = "internal_only"


@dataclass(frozen=True)
class DataSource:
    name: str
    license_class: str          # RESELLABLE | INTERNAL
    license_note: str


# The source registry. Update the Mosaic/APPA notes once your actual licenses
# are confirmed in writing.
SOURCES: dict[str, DataSource] = {
    "census_acs": DataSource("census_acs", RESELLABLE, "U.S. Census ACS, public domain"),
    "hud_crosswalk": DataSource("hud_crosswalk", RESELLABLE, "HUD ZIP-CBSA crosswalk, public domain"),
    "omb_delineation": DataSource("omb_delineation", RESELLABLE, "OMB/Census CBSA delineation, public domain"),
    "proprietary_segmentation": DataSource(
        "proprietary_segmentation", RESELLABLE, "First-party pet-owner segmentation (owned)"
    ),
    "appa_npos": DataSource(
        "appa_npos", RESELLABLE,
        "APPA National Pet Owners Survey -- FIRST-PARTY data owned by APPA "
        "(publisher of the NPOS since 1998). Fully resellable; no third-party terms.",
    ),
    "derived_model": DataSource("derived_model", RESELLABLE, "Outputs of this pipeline's model"),
    "experian_mosaic": DataSource(
        "experian_mosaic", INTERNAL,
        "Experian Mosaic -- licensed. Validation/confirmation ONLY. Do NOT include "
        "in deliverables without a written redistribution/syndication license.",
    ),
}

# Which source each output column originates from.
FIELD_SOURCE: dict[str, str] = {
    "zip": "census_acs",
    "msa_cbsa": "hud_crosswalk",
    "msa_title": "omb_delineation",
    "in_metro": "omb_delineation",
    "persona": "proprietary_segmentation",
    "observed_personas": "proprietary_segmentation",
    "confidence": "derived_model",
    "confidence_raw": "derived_model",
    "confidence_calibrated": "derived_model",
    "provenance": "derived_model",
    "evidence": "derived_model",
    "methodology_version": "derived_model",
    "data_vintage": "derived_model",
    "model_params": "derived_model",
    # Example of a restricted field that would be stripped from deliverables:
    "mosaic_group": "experian_mosaic",
}


def field_license(col: str) -> str:
    """License class for a column; unknown columns default to INTERNAL (fail safe)."""
    src = FIELD_SOURCE.get(col)
    return SOURCES[src].license_class if src else INTERNAL


@dataclass
class ExportManifest:
    included: list[str]
    excluded: list[str]
    sources_used: dict[str, str]
    methodology_version: str
    data_vintage: str
    generated: str = field(default_factory=lambda: date.today().isoformat())

    def to_json(self) -> str:
        return json.dumps(self.__dict__, indent=2)


def export_deliverable(
    df: pd.DataFrame, out_path: str | Path, include_internal: bool = False
) -> ExportManifest:
    """Write a sellable file: resellable fields only, plus a rights manifest.

    Set ``include_internal=True`` *only* for internal analysis, never for a file
    that leaves the building.
    """
    out_path = Path(out_path)
    keep, drop = [], []
    for col in df.columns:
        if include_internal or field_license(col) == RESELLABLE:
            keep.append(col)
        else:
            drop.append(col)

    df[keep].to_csv(out_path, index=False)

    sources_used = {
        c: SOURCES[FIELD_SOURCE[c]].name for c in keep if c in FIELD_SOURCE
    }
    manifest = ExportManifest(
        included=keep,
        excluded=drop,
        sources_used=sources_used,
        methodology_version=str(df.get("methodology_version", pd.Series(["?"])).iloc[0]),
        data_vintage=str(df.get("data_vintage", pd.Series(["?"])).iloc[0]),
    )
    out_path.with_suffix(".manifest.json").write_text(manifest.to_json())
    return manifest


__all__ = [
    "RESELLABLE", "INTERNAL", "DataSource", "SOURCES", "FIELD_SOURCE",
    "field_license", "ExportManifest", "export_deliverable",
]
