"""Stage 1: ZIP -> Metro MSA assignment (deterministic).

Policy chosen for this project: **Metropolitan Statistical Areas only**, with
**dominant assignment** -- each ZIP is assigned to the single Metro MSA that
holds the largest share of its residential addresses (HUD ``res_ratio``).

Micropolitan CBSAs and ZIPs that fall in no Metro MSA are reported with
``msa_cbsa = None`` / ``in_metro = False`` rather than dropped, because that
distinction matters for the rural "disclosed tail" in Stage 3.
"""
from __future__ import annotations

import pandas as pd

from .data_sources import ReferenceData


def build_zip_to_msa(ref: ReferenceData) -> pd.DataFrame:
    """Return one row per ZIP: its dominant Metro MSA (or no-metro).

    Columns: zip, msa_cbsa, msa_title, in_metro
    """
    xwalk = ref.zip_cbsa.merge(ref.cbsa_meta, on="cbsa", how="left")
    # Metro-only policy: keep Metropolitan CBSAs for the assignment decision.
    metro = xwalk[xwalk["metro"].fillna(False)].copy()

    # Dominant assign: highest residential-address ratio wins; ties broken by
    # cbsa code for determinism.
    metro = metro.sort_values(["zip", "res_ratio", "cbsa"], ascending=[True, False, True])
    winners = metro.groupby("zip", as_index=False).first()
    winners = winners.rename(columns={"cbsa": "msa_cbsa", "cbsa_title": "msa_title"})
    winners["in_metro"] = True

    # ZIPs present in the crosswalk but with no metro share at all -> no-metro.
    all_zips = pd.Index(ref.zip_cbsa["zip"].unique(), name="zip")
    no_metro = all_zips.difference(pd.Index(winners["zip"]))
    no_metro_df = pd.DataFrame(
        {"zip": no_metro, "msa_cbsa": None, "msa_title": None, "in_metro": False}
    )

    cols = ["zip", "msa_cbsa", "msa_title", "in_metro"]
    return pd.concat([winners[cols], no_metro_df[cols]], ignore_index=True).sort_values("zip")


def match_zips_to_msa(zips: pd.Series, zip_to_msa: pd.DataFrame) -> pd.DataFrame:
    """Map an arbitrary list of input ZIPs onto the ZIP->MSA frame.

    Input ZIPs with no crosswalk entry (bad/retired/PO-box-only) come back with
    ``matched = False`` so nothing is silently lost.
    """
    s = zips.astype(str).str.extract(r"(\d{1,5})")[0].str.zfill(5)
    in_df = pd.DataFrame({"zip": s})
    out = in_df.merge(zip_to_msa, on="zip", how="left")
    out["matched"] = out["in_metro"].notna()
    return out


__all__ = ["build_zip_to_msa", "match_zips_to_msa"]
