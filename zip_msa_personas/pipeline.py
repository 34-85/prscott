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
    zip_to_dma: pd.DataFrame | None = None,
    market: str = "msa",
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
    # Market geography for shrinkage: MSA (default) or Nielsen DMA.
    dma_map = None
    if zip_to_dma is not None:
        z2d = crosswalk.build_zip_to_dma(zip_to_dma)
        dma_map = z2d.set_index("zip")["dma_code"].to_dict()

    observed_confidence = None
    if shrink_alpha and shrink_alpha > 0:
        if market == "dma" and dma_map:
            market_map = dma_map
        else:
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
    if zip_to_dma is not None:
        enriched = enriched.merge(z2d, on="zip", how="left")
    return PipelineOutput(
        enriched=enriched.sort_values("zip").reset_index(drop=True),
        zip_to_msa=z2m,
        observed_distribution=dist,
        impute_result=result,
    )


def run_demographic_blend(
    persona_path: str | Path,
    ref: ReferenceData | None,
    demographic_mix: pd.DataFrame,
    *,
    alpha: float = 5.0,
    data_vintage: str | None = None,
    zip_to_dma: pd.DataFrame | None = None,
) -> PipelineOutput:
    """Score every ZIP by blending the survey with a demographic prior.

    ``demographic_mix`` (zip x persona prior shares, e.g. from
    ``propensity.score_demographics``) covers the whole country, so this path
    replaces the spatial imputation + disclosed-extrapolation tail with a
    demographics-based estimate everywhere, updated by the survey where it
    exists (empirical Bayes). Provenance is ``survey_anchored`` or
    ``demographic_model``.

    ``ref`` may be ``None`` (e.g. the HUD ZIP->CBSA crosswalk is unreachable):
    the run then proceeds demographics-only with blank MSA labels.
    """
    from . import propensity

    z2m = crosswalk.build_zip_to_msa(ref) if ref is not None else None
    raw = personas.load_personas(persona_path)
    raw_dist = personas.aggregate_to_zip_distribution(raw)

    assignments, distributions = propensity.blend_with_survey(raw_dist, demographic_mix, alpha=alpha)

    if z2m is not None:
        assignments = assignments.merge(
            z2m[["zip", "msa_cbsa", "msa_title", "in_metro"]], on="zip", how="left"
        )
    else:
        # No ZIP->MSA crosswalk: demographics-only run, MSA labels left blank.
        assignments["msa_cbsa"] = pd.NA
        assignments["msa_title"] = pd.NA
        assignments["in_metro"] = pd.NA
    if zip_to_dma is not None:
        z2d = crosswalk.build_zip_to_dma(zip_to_dma)
        assignments = assignments.merge(z2d, on="zip", how="left")
    assignments["methodology_version"] = impute.METHODOLOGY_VERSION
    assignments["data_vintage"] = data_vintage or "unspecified"
    assignments["model_params"] = f"blend_alpha={alpha}"

    enriched = assignments.merge(
        raw_dist.groupby("zip")["persona"].apply(lambda s: ", ".join(sorted(set(s)))).rename("observed_personas"),
        on="zip", how="left",
    )
    result = impute.ImputeResult(
        assignments=assignments, threshold=float("nan"), baselines={}, distributions=distributions
    )
    return PipelineOutput(
        enriched=enriched.sort_values("zip").reset_index(drop=True),
        zip_to_msa=z2m,
        observed_distribution=raw_dist,
        impute_result=result,
    )


__all__ = ["PipelineOutput", "run_pipeline", "run_demographic_blend"]
