"""Spatial predictor + a fair bake-off vs the demographic model.

The demographic model is a weak local predictor. This tests an alternative for
the 82% modeled ZIPs: **spatial smoothing** -- estimate a ZIP's persona mix from
the nearest *surveyed* ZIPs (distance-weighted). It also blends the two, and
compares all three honestly on held-out survey data.

The spatial prediction is leave-one-out (each surveyed ZIP is predicted from its
neighbors, never itself), so validating it against the survey is a fair test.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors

from . import validation


def spatial_loo_predict(survey_wide: pd.DataFrame, coords: pd.DataFrame, k: int = 10) -> pd.DataFrame:
    """Leave-one-out spatial prediction of each surveyed ZIP's persona mix.

    ``survey_wide`` : zip x persona shares (the observed survey mix per ZIP).
    ``coords`` : indexed by zip with 'lat','lon'. Returns zip x persona predictions.
    """
    zips = [z for z in survey_wide.index if z in coords.index]
    X = coords.loc[zips][["lat", "lon"]].to_numpy(float)
    M = survey_wide.loc[zips].to_numpy(float)
    kk = min(k + 1, len(zips))
    nn = NearestNeighbors(n_neighbors=kk).fit(X)
    dist, idx = nn.kneighbors(X)
    preds = np.empty_like(M)
    for i in range(len(zips)):
        nbr, d = idx[i][1:], dist[i][1:]          # drop self
        w = 1.0 / (d + 1e-9)
        preds[i] = (w / w.sum()) @ M[nbr]
    return pd.DataFrame(preds, index=zips, columns=survey_wide.columns)


def blend_mixes(a: pd.DataFrame, b: pd.DataFrame, wa: float = 0.5) -> pd.DataFrame:
    """Weighted blend of two zip x persona mixes (aligned on shared ZIPs)."""
    zips = a.index.intersection(b.index)
    personas = list(a.columns)
    M = wa * a.loc[zips, personas].to_numpy(float) + (1 - wa) * b.loc[zips, personas].to_numpy(float)
    M = M / M.sum(axis=1, keepdims=True)
    return pd.DataFrame(M, index=zips, columns=personas)


def compare_predictors(survey_dist: pd.DataFrame, demographic_mix: pd.DataFrame,
                       coords: pd.DataFrame, group_map: dict, k: int = 10,
                       min_n: float = 30.0) -> pd.DataFrame:
    """Bake-off: demographic vs spatial vs blend, validated against the survey.

    Returns a table of directional agreement / chance / top-1 / MAE per predictor.
    """
    sw = (survey_dist.assign(zip=survey_dist["zip"].astype(str).str.zfill(5))
          .groupby(["zip", "persona"])["weight"].sum().unstack(fill_value=0.0))
    personas = list(demographic_mix.columns)
    sw = sw.reindex(columns=personas, fill_value=0.0)
    survey_wide = sw.div(sw.sum(axis=1).replace(0, 1.0), axis=0)

    spatial = spatial_loo_predict(survey_wide, coords, k=k)
    blended = blend_mixes(spatial, demographic_mix)

    rows = []
    for name, mix in [("demographic", demographic_mix), ("spatial", spatial), ("blend", blended)]:
        try:
            r = validation.validate_model_vs_survey(mix, survey_dist, group_map=group_map, min_n=min_n)
            rows.append({"predictor": name, "units": r.n_units,
                         "directional": round(r.directional_agreement, 3),
                         "chance": round(r.directional_chance, 3),
                         "lift": round(r.directional_agreement - r.directional_chance, 3),
                         "top1": round(r.top1_agreement, 3), "mae": round(r.mean_abs_error, 4)})
        except Exception as e:  # noqa: BLE001
            rows.append({"predictor": name, "units": 0, "error": str(e)[:60]})
    return pd.DataFrame(rows)


__all__ = ["spatial_loo_predict", "blend_mixes", "compare_predictors"]
