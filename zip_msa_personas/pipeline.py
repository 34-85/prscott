"""End-to-end orchestration: ZIP -> MSA -> persona -> impute empty ZIPs.

Glue only. Each stage lives in its own module; this wires them together and
returns one enriched table you can write to CSV.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from . import crosswalk, impute, personas
from .data_sources import ReferenceData


@dataclass
class PipelineOutput:
    enriched: pd.DataFrame          # every ZIP: msa + persona + provenance + confidence
    zip_to_msa: pd.DataFrame
    observed_distribution: pd.DataFrame
    impute_result: impute.ImputeResult


def run_pipeline(
    persona_path: str | Path,
    ref: ReferenceData,
    features: pd.DataFrame,
    config: impute.ImputeConfig | None = None,
) -> PipelineOutput:
    # Stage 1: ZIP -> Metro MSA (dominant assign).
    z2m = crosswalk.build_zip_to_msa(ref)

    # Stage 2: load + join personas.
    raw = personas.load_personas(persona_path)
    dist = personas.aggregate_to_zip_distribution(raw)
    dist = personas.join_personas_to_msa(dist, z2m)

    # Restrict the universe to ZIPs we have geography + features for.
    feat_zips = set(features["zip"])
    z2m_feat = z2m[z2m["zip"].isin(feat_zips)].copy()

    # Stage 3: impute every ZIP that has a feature vector.
    result = impute.impute_personas(features, dist, z2m_feat, config=config)

    enriched = result.assignments.merge(
        dist.groupby("zip")["persona"].apply(lambda s: ", ".join(sorted(set(s)))).rename("observed_personas"),
        on="zip",
        how="left",
    )
    return PipelineOutput(
        enriched=enriched.sort_values("zip").reset_index(drop=True),
        zip_to_msa=z2m,
        observed_distribution=dist,
        impute_result=result,
    )


__all__ = ["PipelineOutput", "run_pipeline"]
