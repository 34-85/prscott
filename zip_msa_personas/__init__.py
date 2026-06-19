"""ZIP -> MSA -> persona enrichment pipeline.

Three stages, three confidence tiers:
  1. crosswalk : ZIP -> Metro MSA (deterministic lookup, dominant assign)
  2. personas  : attach your persona data, aggregate to per-ZIP distributions
  3. impute    : estimate personas for empty ZIPs, tagged observed /
                 imputed_similar / extrapolated_baseline with confidence
"""
from . import crosswalk, data_sources, impute, personas, pipeline  # noqa: F401

__all__ = ["crosswalk", "data_sources", "impute", "personas", "pipeline"]
__version__ = "1.0.0"
