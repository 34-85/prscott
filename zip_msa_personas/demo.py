"""Self-contained demo data so the full pipeline runs without network access.

Generates a realistic-but-synthetic universe: several Metro MSAs plus a no-metro
rural tail, ZIPs with spatially-correlated demographic features, personas that
genuinely track those features, and only a *fraction* of ZIPs observed -- so the
imputation and the disclosed extrapolation tail both get exercised.

This is a stand-in for the real HUD/Census reference data, NOT a data source for
production. Real runs use ``data_sources`` + your persona file.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .data_sources import ReferenceData

# Persona archetypes keyed to a 2-D (income, density) latent position.
_PERSONAS = [
    ("Urban Professionals", (0.8, 0.9)),
    ("Established Suburban Families", (0.7, 0.4)),
    ("Working-Class Commuters", (0.4, 0.5)),
    ("Rural Traditionalists", (0.3, 0.1)),
    ("Affluent Empty-Nesters", (0.9, 0.3)),
]


def _persona_for(income_norm: float, density_norm: float, rng) -> str:
    pos = np.array([income_norm, density_norm])
    dists = [np.linalg.norm(pos - np.array(p)) for _, p in _PERSONAS]
    # Mostly nearest archetype, with a little noise so it isn't perfectly clean.
    if rng.random() < 0.15:
        return _PERSONAS[rng.integers(len(_PERSONAS))][0]
    return _PERSONAS[int(np.argmin(dists))][0]


def make_demo(seed: int = 7, observed_fraction: float = 0.18):
    """Return (ReferenceData, features_df, personas_df)."""
    rng = np.random.default_rng(seed)

    msas = [
        ("35620", "New York-Newark-Jersey City, NY-NJ", 0.85, 0.92, 120),
        ("31080", "Los Angeles-Long Beach-Anaheim, CA", 0.72, 0.80, 100),
        ("16980", "Chicago-Naperville-Elgin, IL-IN-WI", 0.60, 0.70, 90),
        ("19100", "Dallas-Fort Worth-Arlington, TX", 0.65, 0.55, 80),
        ("38900", "Portland-Vancouver-Hillsboro, OR-WA", 0.62, 0.50, 60),
        ("33340", "Milwaukee-Waukesha, WI", 0.50, 0.45, 40),
    ]

    zip_rows, cbsa_rows, feat_rows, persona_rows = [], [], [], []
    zip_counter = 10000

    for cbsa, title, inc_c, den_c, n in msas:
        cbsa_rows.append({"cbsa": cbsa, "cbsa_title": title, "metro": True})
        for _ in range(n):
            zip_counter += rng.integers(1, 5)
            z = str(zip_counter).zfill(5)
            inc = float(np.clip(rng.normal(inc_c, 0.12), 0.05, 0.99))
            den = float(np.clip(rng.normal(den_c, 0.14), 0.02, 0.99))
            zip_rows.append({"zip": z, "cbsa": cbsa, "res_ratio": 1.0})
            feat_rows.append(_features(z, inc, den, rng))
            if rng.random() < observed_fraction:
                persona_rows.append(
                    {"zip": z, "persona": _persona_for(inc, den, rng), "count": int(rng.integers(20, 300))}
                )

    # No-metro rural tail: ZIPs with their own low-density regime and a couple of
    # genuinely "off-manifold" ZIPs to populate the disclosed extrapolation tier.
    for _ in range(70):
        zip_counter += rng.integers(1, 5)
        z = str(zip_counter).zfill(5)
        inc = float(np.clip(rng.normal(0.30, 0.10), 0.02, 0.9))
        den = float(np.clip(rng.normal(0.08, 0.05), 0.0, 0.4))
        zip_rows.append({"zip": z, "cbsa": "99999", "res_ratio": 1.0})  # no metro
        feat_rows.append(_features(z, inc, den, rng))
        if rng.random() < observed_fraction * 0.5:
            persona_rows.append(
                {"zip": z, "persona": _persona_for(inc, den, rng), "count": int(rng.integers(10, 120))}
            )

    ref = ReferenceData(
        zip_cbsa=pd.DataFrame(zip_rows),
        cbsa_meta=pd.DataFrame(cbsa_rows),
    )
    features = pd.DataFrame(feat_rows)
    personas = pd.DataFrame(persona_rows)
    return ref, features, personas


def _features(z, inc, den, rng) -> dict:
    """Map latent (income, density) to plausible ACS-like raw numbers."""
    return {
        "zip": z,
        "median_household_income": round(25000 + inc * 130000 + rng.normal(0, 4000)),
        "population": int(np.clip(den * 60000 + rng.normal(0, 3000), 200, None)),
        "median_age": round(float(np.clip(45 - den * 15 + rng.normal(0, 3), 22, 70)), 1),
        "median_home_value": round(120000 + inc * 700000 + rng.normal(0, 20000)),
        "pct_bachelors": round(float(np.clip(0.1 + inc * 0.6 + rng.normal(0, 0.05), 0, 0.95)), 3),
        "pct_renter": round(float(np.clip(0.15 + den * 0.6 + rng.normal(0, 0.05), 0, 0.95)), 3),
    }


def write_demo_files(out_dir: str | Path):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    _, features, personas = make_demo()
    features.to_csv(out / "zip_features_sample.csv", index=False)
    personas.to_csv(out / "personas_sample.csv", index=False)
    return out / "personas_sample.csv", out / "zip_features_sample.csv"


__all__ = ["make_demo", "write_demo_files"]
