"""Compose a one-page persona profile (deck content + map + top markets).

Combines, for each persona: its name/size/quote/description (from the APPA deck),
its strongest demographic skews (from the fingerprint indices), the persona's
US map, and its top over-indexing markets -- a single sales-ready leave-behind.

matplotlib is imported lazily (optional dependency).
"""
from __future__ import annotations

import json
import textwrap
from pathlib import Path

import pandas as pd

# Readable labels for fingerprint categories.
_LABELS = {
    "genz": "Gen Z", "millennial": "Millennial", "genx": "Gen X", "boomer": "Boomer",
    "low": "Low income", "mid": "Mid income", "high": "High income",
    "white": "White", "black": "Black", "asian": "Asian", "hispanic": "Hispanic",
    "married": "Married", "formerly_married": "Formerly married", "never_married": "Never married",
    "dog": "Dog owner", "cat": "Cat owner", "other": "Exotic/other pet",
    "premium": "Spends freely", "moderate": "Moderate spender", "budget": "Budget-conscious",
    "like_child": "Pet is 'like a child'", "like_friend": "Pet is 'a friend'",
    "like_family": "Pet is 'family'", "just_pet": "Pet is 'just a pet'",
}


def _highlights(fp_persona: dict, min_index: int = 115, top: int = 6):
    """Top over-indexing categories across all fingerprint dimensions."""
    items = []
    for var, cats in fp_persona.items():
        for cat, idx in cats.items():
            if cat in _LABELS and idx >= min_index:
                items.append((_LABELS[cat], idx))
    items.sort(key=lambda t: -t[1])
    return items[:top]


def build_persona_onepager(
    persona: str,
    fingerprints,
    descriptions: dict,
    map_png: str | Path | None,
    top_markets: pd.DataFrame | None,
    out_path: str | Path,
    is_preview: bool = True,
) -> Path:
    """Render a one-pager PNG for ``persona``.

    ``top_markets`` (optional) has columns ['geo', 'index'] -- the persona's
    strongest, statistically real markets.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    info = descriptions.get(persona, {})
    fig = plt.figure(figsize=(11, 8.5), dpi=150)
    fig.patch.set_facecolor("white")

    # Header band
    fig.add_axes([0, 0.88, 1, 0.12]).axis("off")
    fig.text(0.04, 0.945, persona, fontsize=26, fontweight="bold", color="#1F3864", va="center")
    fig.text(0.96, 0.945, info.get("size", ""), fontsize=24, fontweight="bold",
             color="#305496", ha="right", va="center")
    if info.get("quote"):
        fig.text(0.04, 0.905, f"“{info['quote']}”", fontsize=12.5, style="italic", color="#444")

    # Description (upper-left)
    ax = fig.add_axes([0.04, 0.60, 0.44, 0.24]); ax.axis("off")
    desc = textwrap.fill(info.get("description", ""), width=58)
    ax.text(0, 1, desc, fontsize=10.5, va="top", color="#222")

    # Demographic highlights bar chart (lower-left)
    ax = fig.add_axes([0.07, 0.10, 0.38, 0.42])
    hl = _highlights(fingerprints.fingerprints.get(persona, {}))
    if hl:
        labels = [h[0] for h in hl][::-1]
        vals = [h[1] for h in hl][::-1]
        ax.barh(labels, vals, color="#63BE7B")
        ax.axvline(100, color="#888", lw=1, ls="--")
        for y, v in enumerate(vals):
            ax.text(v + 2, y, str(v), va="center", fontsize=9)
        ax.set_xlim(0, max(vals) * 1.18)
        ax.set_title("Over-indexes on  (100 = US avg)", fontsize=11, loc="left")
        ax.tick_params(labelsize=9.5)
        for s in ["top", "right"]:
            ax.spines[s].set_visible(False)

    # Map (right)
    ax = fig.add_axes([0.49, 0.34, 0.50, 0.50]); ax.axis("off")
    if map_png and Path(map_png).exists():
        ax.imshow(plt.imread(str(map_png)))
    ax.set_title("Where they concentrate", fontsize=11)

    # Top markets (lower-right)
    ax = fig.add_axes([0.52, 0.10, 0.44, 0.22]); ax.axis("off")
    if top_markets is not None and not top_markets.empty:
        ax.text(0, 1, "Top markets (index vs US avg)", fontsize=11, fontweight="bold", va="top")
        lines = [f"{r.geo}".strip()[:40].ljust(42) + f"{int(r.index)}"
                 for r in top_markets.head(8).itertuples()]
        ax.text(0, 0.86, "\n".join(lines), fontsize=9.2, va="top", family="monospace")

    footer = ("Source: APPA Pet Owner Segmentation (NPOS). PREVIEW — geography/demographics finalized in official run."
              if is_preview else
              "Source: APPA Pet Owner Segmentation (NPOS) + U.S. Census ACS. Modeled ZIPs are directional; lead with MSA/region.")
    fig.text(0.04, 0.025, footer, fontsize=7.5, color="#999")
    fig.savefig(out_path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return Path(out_path)


def load_descriptions(path: str | Path) -> dict:
    return json.loads(Path(path).read_text())


__all__ = ["build_persona_onepager", "load_descriptions"]
