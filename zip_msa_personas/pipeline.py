"""End-to-end orchestration: ZIP -> MSA -> persona -> impute empty ZIPs.

Glue only. Each stage lives in its own module; this wires them together and
returns one enriched table you can write to CSV.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from . import calibration, crosswalk, impute, personas, shrinkage
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
    data_vintage: str | None = None,
    calibrator: "calibration.Calibrator | None" = None,
    shrink_alpha: float = 0.0,
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

    # Keep the raw observed segments for display before any shrinkage densifies it.
    raw_dist = dist

    # Optional Stage 2b: empirical-Bayes shrinkage of thin ZIPs toward their
    # market (MSA) prior -> denser distributions + honest, sample-size-aware
    # confidence for the observed tier.
    observed_confidence = None
    if shrink_alpha and shrink_alpha > 0:
        market_map = z2m.set_index("zip")["msa_cbsa"].to_dict()
        sr = shrinkage.shrink(dist, alpha=shrink_alpha, market_map=market_map)
        dist, observed_confidence = sr.distribution, sr.confidence

    # Stage 3: impute every ZIP that has a feature vector.
    result = impute.impute_personas(
        features, dist, z2m_feat, config=config, data_vintage=data_vintage,
        observed_confidence=observed_confidence,
    )

    # Optional Stage 3b: calibrate estimate confidence into true probabilities.
    if calibrator is not None:
        result.assignments = calibration.apply_calibration(result.assignments, calibrator)

    enriched = result.assignments.merge(
        raw_dist.groupby("zip")["persona"].apply(lambda s: ", ".join(sorted(set(s)))).rename("observed_personas"),
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
