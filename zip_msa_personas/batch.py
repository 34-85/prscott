"""National batch scoring + coverage reporting.

Scores the full ZCTA universe in one pass and reports how much of the country is
*observed* vs *modeled* vs *disclosed-extrapolated* -- the first question any
buyer asks ("how much of this is real data?"). Coverage is reported nationally,
by metro/non-metro, and per MSA.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from . import impute, pipeline
from .data_sources import ReferenceData

_TIER_ORDER = [impute.OBSERVED, impute.IMPUTED, impute.EXTRAPOLATED]


@dataclass
class CoverageReport:
    total_zips: int
    by_provenance: pd.DataFrame   # tier, zips, pct, mean_confidence
    by_metro: pd.DataFrame        # in_metro x tier counts
    by_msa: pd.DataFrame          # per-MSA tier counts + pct_observed/estimated
    persona_mix: pd.DataFrame     # persona, zips, pct (as top persona)

    def __str__(self) -> str:
        return (
            f"National coverage over {self.total_zips:,} ZIPs\n\n"
            f"By provenance:\n{self.by_provenance.to_string(index=False)}\n\n"
            f"By metro vs non-metro:\n{self.by_metro.to_string(index=False)}\n\n"
            f"Persona mix (as dominant persona):\n{self.persona_mix.head(10).to_string(index=False)}"
        )

    def write(self, out_dir: str | Path) -> None:
        out = Path(out_dir)
        out.mkdir(parents=True, exist_ok=True)
        self.by_provenance.to_csv(out / "coverage_by_provenance.csv", index=False)
        self.by_metro.to_csv(out / "coverage_by_metro.csv", index=False)
        self.by_msa.to_csv(out / "coverage_by_msa.csv", index=False)
        self.persona_mix.to_csv(out / "coverage_persona_mix.csv", index=False)


def coverage_report(enriched: pd.DataFrame) -> CoverageReport:
    total = len(enriched)

    by_prov = (
        enriched.groupby("provenance")
        .agg(zips=("zip", "size"), mean_confidence=("confidence", "mean"))
        .reindex(_TIER_ORDER)
        .dropna(how="all")
        .reset_index()
    )
    by_prov["pct"] = by_prov["zips"] / total

    by_metro = (
        enriched.assign(area=enriched["in_metro"].map({True: "metro", False: "non_metro"}).fillna("unknown"))
        .pivot_table(index="area", columns="provenance", values="zip", aggfunc="count", fill_value=0)
        .reindex(columns=_TIER_ORDER, fill_value=0)
        .reset_index()
    )

    piv = (
        enriched.dropna(subset=["msa_cbsa"])
        .pivot_table(index=["msa_cbsa", "msa_title"], columns="provenance", values="zip", aggfunc="count", fill_value=0)
        .reindex(columns=_TIER_ORDER, fill_value=0)
    )
    piv["total"] = piv.sum(axis=1)
    piv["pct_observed"] = piv[impute.OBSERVED] / piv["total"]
    piv["pct_estimated"] = 1 - piv["pct_observed"]
    by_msa = piv.reset_index().sort_values("total", ascending=False)

    persona_mix = (
        enriched.groupby("persona").agg(zips=("zip", "size")).reset_index().sort_values("zips", ascending=False)
    )
    persona_mix["pct"] = persona_mix["zips"] / total

    return CoverageReport(total, by_prov, by_metro, by_msa, persona_mix)


def run_national(
    persona_path,
    ref: ReferenceData,
    features: pd.DataFrame,
    config: impute.ImputeConfig | None = None,
    data_vintage: str | None = None,
    calibrator=None,
    shrink_alpha: float = 0.0,
    zip_to_dma=None,
    market: str = "msa",
) -> tuple[pipeline.PipelineOutput, CoverageReport]:
    """Score every feature-bearing ZIP and produce a coverage report."""
    out = pipeline.run_pipeline(
        persona_path, ref, features, config=config, data_vintage=data_vintage,
        calibrator=calibrator, shrink_alpha=shrink_alpha, zip_to_dma=zip_to_dma, market=market,
    )
    return out, coverage_report(out.enriched)


__all__ = ["CoverageReport", "coverage_report", "run_national"]
