"""Lightweight US dot-density maps from ZIP-level persona scores.

No shapefiles required: each ZIP is a point at its lon/lat, so 40k points draw
the recognizable shape of the country. Two views:

  * ``dominant_persona_map`` -- every ZIP colored by its winning persona
  * ``index_map``            -- every ZIP colored by one persona's index vs the
                                national average (diverging red->white->green)

matplotlib is imported lazily so it stays an optional dependency.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

# Continental-US framing (AK/HI are still in the data, just off the picture).
_LON = (-125, -66)
_LAT = (24, 50)


def _continental(df, lon_col, lat_col):
    return df[df[lon_col].between(*_LON) & df[lat_col].between(*_LAT)]


def _base_ax(title):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(11, 7), dpi=150)
    ax.set_title(title, fontsize=14)
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_aspect(1.3)  # rough equirectangular correction at mid US latitude
    for s in ax.spines.values():
        s.set_visible(False)
    return plt, fig, ax


def index_map(df, value_col, out_path, *, lon_col="lon", lat_col="lat",
              title=None, vmin=0, vmax=200, point_size=2.0) -> Path:
    """Scatter every ZIP, colored by ``value_col`` (an index where 100 = avg)."""
    plt, fig, ax = _base_ax(title or value_col)
    d = _continental(df.dropna(subset=[lon_col, lat_col, value_col]), lon_col, lat_col)
    sc = ax.scatter(d[lon_col], d[lat_col], c=d[value_col].clip(vmin, vmax),
                    s=point_size, cmap="RdYlGn", vmin=vmin, vmax=vmax, linewidths=0)
    fig.colorbar(sc, ax=ax, shrink=0.6, label="Index vs US average (100 = average)")
    fig.tight_layout(); fig.savefig(out_path, bbox_inches="tight"); plt.close(fig)
    return Path(out_path)


def dominant_persona_map(df, cat_col, out_path, *, lon_col="lon", lat_col="lat",
                         title="Dominant pet-owner persona by ZIP", point_size=2.0) -> Path:
    """Scatter every ZIP, colored by its categorical winning persona."""
    plt, fig, ax = _base_ax(title)
    from matplotlib import colormaps
    d = _continental(df.dropna(subset=[lon_col, lat_col, cat_col]), lon_col, lat_col)
    cats = sorted(d[cat_col].unique())
    colors = colormaps["tab10"].resampled(max(len(cats), 3))
    for i, c in enumerate(cats):
        sub = d[d[cat_col] == c]
        ax.scatter(sub[lon_col], sub[lat_col], s=point_size, color=colors(i), label=c, linewidths=0)
    ax.legend(loc="lower left", fontsize=8, markerscale=4, frameon=True, ncol=2)
    fig.tight_layout(); fig.savefig(out_path, bbox_inches="tight"); plt.close(fig)
    return Path(out_path)


__all__ = ["index_map", "dominant_persona_map"]
