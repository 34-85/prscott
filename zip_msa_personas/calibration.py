"""Confidence calibration -- make the confidence number a literal probability.

The raw confidence from ``impute`` is a principled heuristic that backtests as
*roughly* calibrated. For a commercial deliverable it should be exact: among
estimates labeled 0.80, ~80% should be correct. We achieve that by fitting an
**isotonic regression** that maps raw confidence -> empirical accuracy, learned
from the backtest's own held-out predictions (so it never sees training labels
it later scores).

Why isotonic: it's monotonic (preserves the ranking of confident vs unconfident
estimates) and non-parametric (no assumed shape), which fits geodemographic
data better than a logistic/Platt curve.

The fitted map is stored as plain (x, y) breakpoints in JSON -- portable,
version-stable, no pickle -- and stamped with the methodology version so a
delivered file's confidence is always reproducible.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

from . import impute


@dataclass
class Calibrator:
    """A monotone map raw_confidence -> calibrated probability, applied to estimates."""

    x: list           # grid of raw-confidence breakpoints in [0, 1]
    y: list           # calibrated probability at each breakpoint
    n_train: int
    method: str = "isotonic"
    methodology_version: str = impute.METHODOLOGY_VERSION

    def transform(self, raw) -> np.ndarray:
        return np.clip(np.interp(np.asarray(raw, dtype=float), self.x, self.y), 0.0, 1.0)

    def to_json(self) -> str:
        return json.dumps(self.__dict__, indent=2)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(self.to_json())

    @classmethod
    def from_json(cls, s: str) -> "Calibrator":
        return cls(**json.loads(s))

    @classmethod
    def load(cls, path: str | Path) -> "Calibrator":
        return cls.from_json(Path(path).read_text())


def fit_calibrator(predictions: pd.DataFrame, grid_size: int = 101) -> Calibrator:
    """Fit an isotonic calibrator on backtest predictions for the *estimated* tiers.

    Observed rows are excluded -- they are ground truth, not estimates, so they
    neither need nor should drive calibration.
    """
    est = predictions[predictions["provenance"] != impute.OBSERVED]
    if len(est) < 10:
        raise ValueError("Too few estimated predictions to calibrate (need >= 10).")
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    iso.fit(est["confidence"].to_numpy(float), est["correct"].astype(float).to_numpy())
    grid = np.linspace(0.0, 1.0, grid_size)
    return Calibrator(x=grid.tolist(), y=iso.predict(grid).tolist(), n_train=int(len(est)))


def expected_calibration_error(confidence, correct, n_bins: int = 10) -> float:
    """Weighted mean |confidence - accuracy| across equal-width bins (ECE)."""
    confidence = np.asarray(confidence, dtype=float)
    correct = np.asarray(correct, dtype=float)
    bins = np.linspace(0, 1, n_bins + 1)
    idx = np.clip(np.digitize(confidence, bins) - 1, 0, n_bins - 1)
    ece = 0.0
    for b in range(n_bins):
        m = idx == b
        if m.any():
            ece += m.mean() * abs(confidence[m].mean() - correct[m].mean())
    return float(ece)


def apply_calibration(assignments: pd.DataFrame, calibrator: Calibrator) -> pd.DataFrame:
    """Rewrite ``confidence`` to the calibrated probability for estimated rows.

    Keeps the original heuristic in ``confidence_raw`` for audit; observed rows
    are left untouched (their confidence reflects data certainty, not a model).
    """
    out = assignments.copy()
    out["confidence_raw"] = out["confidence"]
    mask = out["provenance"] != impute.OBSERVED
    out.loc[mask, "confidence"] = np.round(calibrator.transform(out.loc[mask, "confidence"]), 4)
    out["confidence_calibrated"] = True
    return out


def evaluate_calibration(predictions: pd.DataFrame, test_frac: float = 0.3, seed: int = 0) -> dict:
    """Honest, held-out ECE: fit the calibrator on a train split, score the test
    split. Avoids the optimism of measuring on the same rows used to fit.

    The calibrator returned to production should still be fit on *all* data via
    ``fit_calibrator``; this function only estimates how much calibration helps.
    """
    est = predictions[predictions["provenance"] != impute.OBSERVED].reset_index(drop=True)
    rng = np.random.default_rng(seed)
    test_mask = rng.random(len(est)) < test_frac
    train, test = est[~test_mask], est[test_mask]
    if len(train) < 10 or len(test) < 10:
        # Not enough to split; fall back to in-sample with a disclosed flag.
        cal = fit_calibrator(est)
        before = expected_calibration_error(est["confidence"], est["correct"])
        after = expected_calibration_error(cal.transform(est["confidence"]), est["correct"])
        return {"ece_before": round(before, 4), "ece_after": round(after, 4), "n": int(len(est)), "held_out": False}
    cal = fit_calibrator(train)
    before = expected_calibration_error(test["confidence"], test["correct"])
    after = expected_calibration_error(cal.transform(test["confidence"]), test["correct"])
    return {"ece_before": round(before, 4), "ece_after": round(after, 4), "n": int(len(test)), "held_out": True}


__all__ = [
    "Calibrator", "fit_calibrator", "apply_calibration",
    "expected_calibration_error", "evaluate_calibration",
]
