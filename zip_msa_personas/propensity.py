"""Demographic-propensity model: persona mix from Census demographics.

The APPA segmentation deck gives, for each persona, an **index** per demographic
category (age, income, race/ethnicity, marital status) -- e.g. Ambitious
Go-Getters index 131 on Millennials, 116 on high income. An index is a
likelihood ratio (100 = national average), so we can score any ZIP's
demographics against every persona's fingerprint and estimate its persona mix --
*without* needing the survey to have reached that ZIP.

Model (naive-Bayes / log-linear over demographic marginals):

    score(persona | zip) = base_rate(persona)
                           * PROD over variables v of
                             ( SUM over categories c of  frac_zip[v,c] * index[persona,v,c] / 100 )

then normalize across personas so the mix sums to 1. The inner sum is the ZIP's
average index for that persona on variable v; the product combines variables
under an independence assumption. Everything is explainable: each persona's
score decomposes into which demographics drove it.

Only Census-available variables are used to *predict* (age, income, race,
marital). Pet type / spend / role are persona descriptors, not ZIP-level
predictors, so they live in the fingerprint for profiling but not scoring.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

DEFAULT_FINGERPRINTS = Path(__file__).resolve().parent / "data" / "persona_fingerprints.json"

# How each predictive variable's categories map to expected demographic-fraction
# columns. The official run produces these fractions per ZIP from ACS:
#   age      -> generations from ACS age bands (B01001)
#   income   -> household-income tiers (B19001): low/<50k, mid/50-100k, high/>100k
#   race     -> B02001 + Hispanic origin B03003 (normalized within the variable)
#   marital  -> B12001: married / formerly (widowed+divorced+separated) / never
ACS_CATEGORY_SPEC = {
    "age": ["genz", "millennial", "genx", "boomer"],
    "income": ["low", "mid", "high"],
    "race": ["white", "black", "asian", "hispanic"],
    "marital": ["married", "formerly_married", "never_married"],
}


@dataclass
class Fingerprints:
    base_rates: dict
    fingerprints: dict          # persona -> var -> category -> index
    meta: dict

    @property
    def personas(self) -> list[str]:
        return list(self.fingerprints)


def load_fingerprints(path: str | Path = DEFAULT_FINGERPRINTS) -> Fingerprints:
    d = json.loads(Path(path).read_text())
    return Fingerprints(d["base_rates"], d["fingerprints"], d.get("_meta", {}))


def _col(var: str, cat: str) -> str:
    return f"{var}_{cat}"


def score_demographics(
    demographics: pd.DataFrame,
    fp: Fingerprints | None = None,
    predictive_vars: list[str] | None = None,
) -> pd.DataFrame:
    """Per-ZIP persona mix from demographic fractions.

    ``demographics`` is indexed by zip with columns ``<var>_<category>`` holding
    the ZIP's population fraction in each category (e.g. ``age_genz``,
    ``income_high``, ``race_white``, ``marital_married``). Categories within a
    variable are normalized to sum to 1 (defensive).

    Returns a DataFrame indexed by zip with one column per persona (shares that
    sum to 1).
    """
    fp = fp or load_fingerprints()
    vars_ = predictive_vars or fp.meta.get("predictive_vars") or list(ACS_CATEGORY_SPEC)
    personas = fp.personas
    df = demographics.copy()

    # Normalize each variable's category fractions to sum to 1 per ZIP.
    norm = {}
    for v in vars_:
        cats = ACS_CATEGORY_SPEC[v]
        cols = [_col(v, c) for c in cats if _col(v, c) in df.columns]
        block = df[cols].fillna(0.0).to_numpy(float)
        totals = block.sum(axis=1, keepdims=True)
        totals[totals == 0] = 1.0
        norm[v] = (block / totals, cats, cols)

    log_scores = np.zeros((len(df), len(personas)))
    for pi, persona in enumerate(personas):
        ls = np.log(max(fp.base_rates.get(persona, 1e-6), 1e-9))
        for v in vars_:
            block, cats, cols = norm[v]
            idx = np.array([fp.fingerprints[persona].get(v, {}).get(c, 100) / 100.0
                            for c in cats if _col(v, c) in df.columns])
            avg_index = block @ idx            # ZIP's avg index for this persona/var
            avg_index = np.clip(avg_index, 1e-6, None)
            ls = ls + np.log(avg_index)
        log_scores[:, pi] = ls

    # Softmax across personas -> mix that sums to 1.
    log_scores -= log_scores.max(axis=1, keepdims=True)
    w = np.exp(log_scores)
    mix = w / w.sum(axis=1, keepdims=True)
    return pd.DataFrame(mix, index=df.index, columns=personas)


SURVEY_ANCHORED = "survey_anchored"
DEMOGRAPHIC_MODEL = "demographic_model"


def blend_with_survey(
    survey_dist: pd.DataFrame,
    demographic_mix: pd.DataFrame,
    alpha: float = 5.0,
):
    """Empirical-Bayes blend of the survey with a per-ZIP demographic prior.

    For every ZIP that has a demographic prior:
      * if the survey reached it -> posterior = (survey_counts + alpha*prior) /
        (n + alpha), tagged ``survey_anchored``;
      * otherwise -> the demographic prior itself, tagged ``demographic_model``.

    Because the demographic model covers every ZIP, this eliminates the
    disclosed low-confidence extrapolation tail: empty ZIPs get a real,
    demographics-based estimate instead of a coarse baseline.

    Parameters
    ----------
    survey_dist : long (zip, persona, weight) -- raw survey weighted counts.
    demographic_mix : DataFrame indexed by zip, one column per persona (prior
        shares summing to 1), e.g. from ``score_demographics``.

    Returns
    -------
    (assignments, distributions) :
        assignments -> zip, persona, confidence, provenance
        distributions -> long zip, persona, share
    """
    personas = list(demographic_mix.columns)
    surv = (
        survey_dist.groupby(["zip", "persona"])["weight"].sum().unstack(fill_value=0.0)
        .reindex(columns=personas, fill_value=0.0)
    )
    n = surv.sum(axis=1)

    arr = demographic_mix.to_numpy(float)
    arr = arr / arr.sum(axis=1, keepdims=True)
    surv_idx = {z: i for i, z in enumerate(surv.index)}

    assign, dist_rows = [], []
    for zi, z in enumerate(demographic_mix.index):
        prior = arr[zi]
        if z in surv_idx and n.iloc[surv_idx[z]] > 0:
            w = surv.iloc[surv_idx[z]].to_numpy(float)
            nz = w.sum()
            post = (w + alpha * prior) / (nz + alpha)
            prov = SURVEY_ANCHORED
        else:
            post = prior
            prov = DEMOGRAPHIC_MODEL
            nz = 0.0
        post = post / post.sum()
        ti = int(post.argmax())
        # eff_n = survey weighted respondents behind this ZIP; support = the
        # own-data fraction n/(n+alpha). Both let downstream rollups down-weight
        # thin survey ZIPs so a 1-2 respondent spike can't dominate a market mix.
        support = nz / (nz + alpha) if nz > 0 else 0.0
        assign.append((z, personas[ti], round(float(post[ti]), 4), prov,
                       round(float(nz), 3), round(float(support), 4)))
        for p, v in zip(personas, post):
            if v > 0:
                dist_rows.append((z, p, round(float(v), 5)))

    assignments = pd.DataFrame(assign, columns=["zip", "persona", "confidence", "provenance", "eff_n", "support"])
    distributions = pd.DataFrame(dist_rows, columns=["zip", "persona", "share"])
    return assignments, distributions


def dominant(mix: pd.DataFrame) -> pd.DataFrame:
    """Top persona + its share per ZIP."""
    top = mix.idxmax(axis=1)
    return pd.DataFrame({"persona": top, "share": mix.max(axis=1)}, index=mix.index)


def national_mix(mix: pd.DataFrame, weights=None) -> pd.Series:
    """Population-weighted national average persona mix (the real headline number,
    not the argmax 'dominant-persona' count, which over-states the largest segment).
    """
    M = mix.to_numpy(float)
    w = np.ones(len(M)) if weights is None else np.asarray(weights, float)
    w = w / w.sum()
    return pd.Series(w @ M, index=mix.columns).sort_values(ascending=False)


def fit_national_calibration(mix: pd.DataFrame, target_rates: dict, weights=None,
                             iters: int = 100, tol: float = 1e-7) -> dict:
    """Raking factors so the population-weighted national mix matches the survey.

    The raw demographic propensity, applied across all ZIPs, can drift from the
    known national segment sizes (e.g. over-weighting broad signals like
    white/Boomer). This fits one multiplicative factor per persona via iterative
    proportional fitting so the calibrated national mix equals ``target_rates``.
    """
    personas = list(mix.columns)
    target = np.array([target_rates[p] for p in personas], float)
    target = target / target.sum()
    M = mix[personas].to_numpy(float)
    w = np.ones(len(M)) if weights is None else np.asarray(weights, float)
    w = w / w.sum()
    f = np.ones(len(personas))
    for _ in range(iters):
        adj = M * f
        adj = adj / adj.sum(axis=1, keepdims=True)
        cur = w @ adj
        if np.max(np.abs(cur - target)) < tol:
            break
        f = f * (target / np.clip(cur, 1e-12, None))
    return dict(zip(personas, f))


def apply_national_calibration(mix: pd.DataFrame, factors: dict) -> pd.DataFrame:
    """Apply raking factors and renormalize each ZIP's mix to sum to 1."""
    personas = list(mix.columns)
    M = mix[personas].to_numpy(float) * np.array([factors[p] for p in personas])
    M = M / M.sum(axis=1, keepdims=True)
    return pd.DataFrame(M, index=mix.index, columns=personas)


def national_index(mix: pd.DataFrame, base_rates: dict) -> pd.DataFrame:
    """Convert a persona mix to index vs the national base rate (100 = average)."""
    out = mix.copy()
    for p in out.columns:
        out[p] = out[p] / max(base_rates.get(p, 1e-9), 1e-9) * 100
    return out.round(0)


__all__ = [
    "Fingerprints", "load_fingerprints", "score_demographics", "dominant",
    "national_index", "blend_with_survey", "national_mix",
    "fit_national_calibration", "apply_national_calibration",
    "ACS_CATEGORY_SPEC", "DEFAULT_FINGERPRINTS", "SURVEY_ANCHORED", "DEMOGRAPHIC_MODEL",
]
