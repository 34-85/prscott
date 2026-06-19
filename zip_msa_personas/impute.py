"""Stage 3: estimate personas for empty ZIPs, with provenance + confidence.

Every ZIP in the output is labeled with how its persona was determined:

    observed              -> persona came from your file (ground truth)
    imputed_similar       -> empty ZIP that closely resembles observed ZIP(s);
                             persona predicted by distance-weighted neighbors
    extrapolated_baseline -> empty ZIP unlike any observed ZIP; falls back to its
                             MSA-level (or national) baseline. THIS IS THE
                             DISCLOSED, LOWEST-CONFIDENCE TIER.

The "similar enough" cutoff is **data-driven**, not a magic constant: we measure
how far observed ZIPs sit from each other in feature space and use a high
percentile of that distribution as the threshold. An empty ZIP closer than the
cutoff to a real observation is treated as similar; beyond it, it is disclosed
as extrapolated.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

OBSERVED = "observed"
IMPUTED = "imputed_similar"
EXTRAPOLATED = "extrapolated_baseline"

# Bump when the imputation logic changes in a way that alters outputs. Stamped
# onto every row so a delivered file can always be traced to the method here.
METHODOLOGY_VERSION = "1.0.0"


@dataclass
class ImputeConfig:
    k: int = 10                      # neighbors used for prediction
    similarity_percentile: float = 90.0  # cutoff on observed-to-observed distances
    feature_cols: list[str] | None = None  # default: all numeric except 'zip'


@dataclass
class ImputeResult:
    assignments: pd.DataFrame  # zip, persona, confidence, provenance, msa_cbsa, ...
    threshold: float
    baselines: dict = field(default_factory=dict)


def _feature_matrix(features: pd.DataFrame, cols: list[str]):
    X = features[cols].to_numpy(dtype=float)
    X = SimpleImputer(strategy="median").fit_transform(X)
    scaler = StandardScaler().fit(X)
    return scaler.transform(X), scaler


def _baseline_distributions(observed_dist: pd.DataFrame) -> dict:
    """MSA-level and national persona baselines from the observed data."""
    baselines = {"__national__": _shares(observed_dist, None)}
    for msa, grp in observed_dist.dropna(subset=["msa_cbsa"]).groupby("msa_cbsa"):
        baselines[msa] = _shares(grp, None)
    return baselines


def _shares(df: pd.DataFrame, _unused) -> dict:
    s = df.groupby("persona")["weight"].sum()
    total = s.sum()
    return (s / total).to_dict() if total else {}


def impute_personas(
    features: pd.DataFrame,
    observed_dist: pd.DataFrame,
    zip_to_msa: pd.DataFrame,
    config: ImputeConfig | None = None,
    data_vintage: str | None = None,
) -> ImputeResult:
    """Produce a persona estimate for *every* ZIP that has a feature vector.

    Parameters
    ----------
    features : per-ZIP numeric feature frame (must include column 'zip').
    observed_dist : long persona distribution from ``aggregate_to_zip_distribution``.
    zip_to_msa : Stage-1 ZIP -> Metro MSA frame.
    """
    config = config or ImputeConfig()
    # Ensure the observed frame carries its MSA (baselines need it); derive from
    # the crosswalk if the caller didn't pre-join it.
    if "msa_cbsa" not in observed_dist.columns:
        observed_dist = observed_dist.merge(
            zip_to_msa[["zip", "msa_cbsa"]], on="zip", how="left"
        )
    cols = config.feature_cols or [
        c for c in features.columns if c != "zip" and pd.api.types.is_numeric_dtype(features[c])
    ]
    feats = features.drop_duplicates("zip").reset_index(drop=True)
    X, _ = _feature_matrix(feats, cols)
    zip_index = {z: i for i, z in enumerate(feats["zip"])}

    observed_zips = sorted(set(observed_dist["zip"]) & set(zip_index))
    if not observed_zips:
        raise ValueError("No observed ZIPs have feature vectors; cannot impute.")
    obs_rows = [zip_index[z] for z in observed_zips]
    X_obs = X[obs_rows]

    # Data-driven similarity threshold: distribution of observed<->observed
    # nearest-neighbor distances (excluding self).
    nn_obs = NearestNeighbors(n_neighbors=min(2, len(obs_rows))).fit(X_obs)
    d_self, _ = nn_obs.kneighbors(X_obs)
    self_nn = d_self[:, 1] if d_self.shape[1] > 1 else d_self[:, 0]
    threshold = float(np.percentile(self_nn, config.similarity_percentile))

    # Predictor over observed ZIPs.
    k = min(config.k, len(obs_rows))
    nn_pred = NearestNeighbors(n_neighbors=k).fit(X_obs)

    # Per-observed-zip persona distribution as dict for fast lookup.
    obs_dist_map = {
        z: grp.set_index("persona")["share"].to_dict()
        for z, grp in observed_dist.groupby("zip")
    }
    baselines = _baseline_distributions(observed_dist)
    msa_map = zip_to_msa.set_index("zip")["msa_cbsa"].to_dict()

    records = []
    observed_set = set(observed_zips)
    for z, i in zip_index.items():
        msa = msa_map.get(z)
        if z in observed_set:
            persona, share = _top(obs_dist_map[z])
            records.append((z, persona, round(min(1.0, 0.5 + share / 2), 4), OBSERVED, msa, ""))
            continue

        dist, idx = nn_pred.kneighbors(X[i : i + 1])
        dist, idx = dist[0], idx[0]
        nearest = dist[0]
        if nearest <= threshold:
            persona, conf, evidence = _weighted_vote(dist, idx, observed_zips, obs_dist_map, threshold)
            records.append((z, persona, round(conf, 4), IMPUTED, msa, evidence))
        else:
            base = baselines.get(msa) or baselines["__national__"]
            persona, share = _top(base)
            # Confidence decays with how far beyond the cutoff we are.
            conf = round(float(0.25 * threshold / max(nearest, 1e-9)) * max(share, 0.0), 4)
            evidence = f"baseline:{'msa:' + msa if msa in baselines else 'national'}"
            records.append((z, persona, min(conf, 0.25), EXTRAPOLATED, msa, evidence))

    assignments = pd.DataFrame(
        records,
        columns=["zip", "persona", "confidence", "provenance", "msa_cbsa", "evidence"],
    )
    assignments = assignments.merge(
        zip_to_msa[["zip", "msa_title", "in_metro"]], on="zip", how="left"
    )
    # Lineage stamps -- so every row can be audited back to method + data vintage.
    assignments["methodology_version"] = METHODOLOGY_VERSION
    assignments["data_vintage"] = data_vintage or "unspecified"
    assignments["model_params"] = f"k={k};sim_pct={config.similarity_percentile}"
    return ImputeResult(assignments=assignments, threshold=threshold, baselines=baselines)


def _top(dist: dict):
    if not dist:
        return ("unknown", 0.0)
    persona = max(dist, key=lambda p: (dist[p], p))
    return persona, float(dist[persona])


def _weighted_vote(dist, idx, observed_zips, obs_dist_map, threshold):
    """Distance-weighted blend of neighbors' persona distributions.

    Confidence = (winning persona's blended share) * (proximity factor), where
    proximity rewards neighbors sitting well inside the similarity cutoff.
    """
    weights = 1.0 / (dist + 1e-9)
    blended: dict[str, float] = {}
    for w, j in zip(weights, idx):
        for persona, share in obs_dist_map[observed_zips[j]].items():
            blended[persona] = blended.get(persona, 0.0) + w * share
    total = sum(blended.values()) or 1.0
    blended = {p: v / total for p, v in blended.items()}
    persona, share = _top(blended)
    proximity = float(np.clip(threshold / (dist.mean() + 1e-9), 0.0, 1.0))
    confidence = 0.4 + 0.6 * share * proximity  # imputed tier: 0.4 .. 1.0
    # Lineage: the look-alike observed ZIPs (and proximity weights) behind this.
    top = sorted(zip(idx, weights), key=lambda t: -t[1])[:3]
    evidence = "neighbors:" + ",".join(
        f"{observed_zips[j]}:{w / weights.sum():.2f}" for j, w in top
    )
    return persona, min(confidence, 0.99), evidence


def summarize(result: ImputeResult) -> pd.DataFrame:
    """Provenance breakdown with mean confidence -- the headline QA table."""
    a = result.assignments
    return (
        a.groupby("provenance")
        .agg(zips=("zip", "size"), mean_confidence=("confidence", "mean"))
        .reindex([OBSERVED, IMPUTED, EXTRAPOLATED])
        .dropna(how="all")
        .reset_index()
    )


__all__ = ["ImputeConfig", "ImputeResult", "impute_personas", "summarize",
           "OBSERVED", "IMPUTED", "EXTRAPOLATED", "METHODOLOGY_VERSION"]
