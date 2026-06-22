"""Backtesting + calibration: does the confidence number mean what it says?

This is the commercial credibility centerpiece. The estimate for an empty ZIP is
only sellable if its confidence is *calibrated* -- i.e. among predictions we
label "0.78", roughly 78% are actually correct.

Method: k-fold cross-validation over the *observed* ZIPs. In each fold we hide a
slice of real observations, predict them as if they were empty (reusing the
exact production imputation path), and compare the predicted top persona to the
known truth. We then bin predictions by confidence and report empirical accuracy
per band -- a calibration curve you can put in front of a customer.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score

from . import impute, personas


@dataclass
class CalibrationReport:
    per_band: pd.DataFrame      # confidence band -> n, mean_confidence, accuracy
    by_tier: pd.DataFrame       # provenance tier -> n, accuracy
    overall_accuracy: float
    calibration_error: float    # weighted mean |confidence - accuracy| across bands
    n_evaluated: int
    predictions: pd.DataFrame = None  # raw per-ZIP: confidence, correct, provenance

    def __str__(self) -> str:
        return (
            f"Backtest over {self.n_evaluated} held-out observed ZIPs\n"
            f"Overall top-persona accuracy: {self.overall_accuracy:.1%}\n"
            f"Calibration error (lower is better): {self.calibration_error:.3f}\n\n"
            f"Accuracy by confidence band:\n{self.per_band.to_string(index=False)}\n\n"
            f"Accuracy by provenance tier:\n{self.by_tier.to_string(index=False)}"
        )


def backtest(
    features: pd.DataFrame,
    observed_dist: pd.DataFrame,
    zip_to_msa: pd.DataFrame,
    config: impute.ImputeConfig | None = None,
    n_splits: int = 5,
    seed: int = 0,
) -> CalibrationReport:
    """Cross-validated calibration report over the observed ZIPs."""
    config = config or impute.ImputeConfig()
    truth = personas.top_persona_per_zip(observed_dist).set_index("zip")["persona"].to_dict()
    obs_zips = np.array(sorted(set(observed_dist["zip"]) & set(features["zip"])))
    if len(obs_zips) < n_splits * 2:
        n_splits = max(2, len(obs_zips) // 2)

    rng = np.random.default_rng(seed)
    folds = np.array_split(rng.permutation(obs_zips), n_splits)

    rows = []
    for fold in folds:
        held = set(fold.tolist())
        train_dist = observed_dist[~observed_dist["zip"].isin(held)]
        if train_dist["zip"].nunique() < config.k:
            continue
        result = impute.impute_personas(features, train_dist, zip_to_msa, config=config)
        preds = result.assignments[result.assignments["zip"].isin(held)]
        for _, r in preds.iterrows():
            rows.append(
                {
                    "zip": r["zip"],
                    "predicted": r["persona"],
                    "actual": truth.get(r["zip"]),
                    "confidence": r["confidence"],
                    "provenance": r["provenance"],
                    "correct": r["persona"] == truth.get(r["zip"]),
                }
            )

    evald = pd.DataFrame(rows)
    if evald.empty:
        raise ValueError("Backtest produced no evaluable predictions (too little observed data).")

    bands = pd.cut(evald["confidence"], bins=np.linspace(0, 1, 11), include_lowest=True)
    per_band = (
        evald.groupby(bands, observed=True)
        .agg(n=("correct", "size"), mean_confidence=("confidence", "mean"), accuracy=("correct", "mean"))
        .reset_index()
        .rename(columns={"confidence": "confidence_band"})
    )
    by_tier = (
        evald.groupby("provenance")
        .agg(n=("correct", "size"), accuracy=("correct", "mean"))
        .reset_index()
    )
    cal_err = float(
        np.average(
            (per_band["mean_confidence"] - per_band["accuracy"]).abs(),
            weights=per_band["n"],
        )
    )
    return CalibrationReport(
        per_band=per_band,
        by_tier=by_tier,
        overall_accuracy=float(evald["correct"].mean()),
        calibration_error=cal_err,
        n_evaluated=len(evald),
        predictions=evald[["zip", "confidence", "correct", "provenance"]],
    )


@dataclass
class ConcordanceReport:
    """How strongly our personas align with an external segmentation (e.g. Mosaic).

    Used as an *internal confirmation* signal -- it measures agreement without
    redistributing the external labels, so it respects an internal-only license.
    """

    n_overlap: int
    normalized_mutual_info: float   # 0 (independent) .. 1 (perfectly aligned)
    adjusted_rand: float            # ~0 (chance) .. 1 (identical partitions)
    crosstab: pd.DataFrame

    def __str__(self) -> str:
        return (
            f"Concordance over {self.n_overlap} ZIPs present in both sources\n"
            f"Normalized mutual information: {self.normalized_mutual_info:.3f}\n"
            f"Adjusted Rand index:           {self.adjusted_rand:.3f}\n"
            "(higher = our personas are independently corroborated by the external "
            "segmentation; this stays internal -- no external labels are redistributed)"
        )


def concordance(assignments: pd.DataFrame, external: pd.DataFrame) -> ConcordanceReport:
    """Compare our persona labels to an external per-ZIP segmentation.

    Parameters
    ----------
    assignments : pipeline output with columns ['zip', 'persona'].
    external : DataFrame with ['zip', external_label_col]; the second column is
        treated as the external segment (e.g. a Mosaic group). Only ZIPs present
        in both are compared.
    """
    label_col = [c for c in external.columns if c != "zip"][0]
    merged = assignments[["zip", "persona"]].merge(
        external[["zip", label_col]].rename(columns={label_col: "external"}),
        on="zip",
    ).dropna()
    if merged.empty:
        raise ValueError("No overlapping ZIPs between our output and the external segmentation.")
    ours = merged["persona"].astype("category").cat.codes
    theirs = merged["external"].astype("category").cat.codes
    return ConcordanceReport(
        n_overlap=len(merged),
        normalized_mutual_info=float(normalized_mutual_info_score(ours, theirs)),
        adjusted_rand=float(adjusted_rand_score(ours, theirs)),
        crosstab=pd.crosstab(merged["persona"], merged["external"]),
    )


@dataclass
class ModelSurveyReport:
    """How well the demographic model alone reproduces the surveyed persona mix."""

    n_units: int
    top1_agreement: float          # fraction where model's top persona == survey's
    mean_abs_error: float          # mean |model_share - survey_share|
    per_persona_corr: dict         # persona -> Pearson r across units

    def __str__(self) -> str:
        corr = "\n".join(f"  {p:<22} r={v:+.2f}" for p, v in self.per_persona_corr.items())
        return (
            f"Model-vs-survey over {self.n_units} units (survey n>=min_n)\n"
            f"Top-persona agreement: {self.top1_agreement:.1%}\n"
            f"Mean absolute share error: {self.mean_abs_error:.3f}\n"
            f"Per-persona correlation:\n{corr}"
        )


def validate_model_vs_survey(model_mix, survey_dist, group_map=None, min_n: float = 30.0):
    """Does the demographic model reproduce the actual surveyed mix?

    Compares the demographic-propensity mix to the survey on shared geography.
    Because the ZIP-level survey is thin, pass ``group_map`` (zip -> MSA/DMA/state)
    to aggregate to a level where the survey is reliable; units with survey
    weight below ``min_n`` are dropped.
    """
    personas = list(model_mix.columns)
    surv = survey_dist.copy()
    surv["zip"] = surv["zip"].astype(str).str.zfill(5)
    mm = model_mix.copy()
    mm.index = mm.index.astype(str).str.zfill(5)

    if group_map:
        surv["unit"] = surv["zip"].map(group_map)
        mm_unit = mm.groupby(mm.index.map(group_map)).mean()
    else:
        surv["unit"] = surv["zip"]
        mm_unit = mm
    surv = surv.dropna(subset=["unit"])

    sw = (surv.groupby(["unit", "persona"])["weight"].sum().unstack(fill_value=0.0)
          .reindex(columns=personas, fill_value=0.0))
    n = sw.sum(axis=1)
    sw_share = sw.div(n.replace(0, 1.0), axis=0)

    units = [u for u in sw_share.index if u in mm_unit.index and n[u] >= min_n]
    if not units:
        raise ValueError("No geographies meet min_n in both the model and the survey.")
    S = sw_share.loc[units, personas]
    M = mm_unit.loc[units, personas]

    top1 = float((S.to_numpy().argmax(1) == M.to_numpy().argmax(1)).mean())
    mae = float(np.abs(S.to_numpy() - M.to_numpy()).mean())
    corr = {}
    for p in personas:
        a, b = M[p].to_numpy(float), S[p].to_numpy(float)
        corr[p] = float(np.corrcoef(a, b)[0, 1]) if a.std() > 0 and b.std() > 0 else float("nan")
    return ModelSurveyReport(len(units), top1, mae, corr)


__all__ = ["CalibrationReport", "backtest", "ConcordanceReport", "concordance",
           "ModelSurveyReport", "validate_model_vs_survey"]
