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

from . import impute, personas


@dataclass
class CalibrationReport:
    per_band: pd.DataFrame      # confidence band -> n, mean_confidence, accuracy
    by_tier: pd.DataFrame       # provenance tier -> n, accuracy
    overall_accuracy: float
    calibration_error: float    # weighted mean |confidence - accuracy| across bands
    n_evaluated: int

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
    )


__all__ = ["CalibrationReport", "backtest"]
