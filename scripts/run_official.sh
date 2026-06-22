#!/usr/bin/env bash
#
# run_official.sh -- full-resolution national run.
#
# Demographics-driven: pulls Census ACS, scores every ZIP against the persona
# fingerprints (propensity model), then anchors with the NPOS survey where it
# exists. Needs census.gov + huduser.gov reachable (allowlist, or run locally).
#
# After scoring, it builds the combined market-viability + vet-siting sheet
# (persona economic value x HH income x addressable demand x service model,
# reliability-filtered) -- the headline deliverable -- into the same outdir.
#
# Usage:
#   scripts/run_official.sh --appa NPOS_zip_by_segment.xlsx \
#       [--zip-dma licensed_zip_dma.csv] [--year 2022] [--outdir ./out_official] \
#       [--census-key KEY] [--venv]
#   (--census-key also read from $CENSUS_API_KEY; needed for the income/demand layer)
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"; cd "$ROOT"

APPA=""; ZIP_DMA=""; YEAR="2022"; OUTDIR="$ROOT/out_official"; USE_VENV="0"
CENSUS_KEY="${CENSUS_API_KEY:-}"
while [[ $# -gt 0 ]]; do case "$1" in
  --appa) APPA="$2"; shift 2;; --zip-dma) ZIP_DMA="$2"; shift 2;;
  --year) YEAR="$2"; shift 2;; --outdir) OUTDIR="$2"; shift 2;;
  --census-key) CENSUS_KEY="$2"; shift 2;;
  --venv) USE_VENV="1"; shift;; -h|--help) sed -n '2,18p' "$0"; exit 0;;
  *) echo "Unknown arg: $1" >&2; exit 64;; esac; done
[[ -z "$APPA" ]] && { echo "ERROR: --appa is required." >&2; exit 64; }

PY="python3"
if [[ "$USE_VENV" == "1" ]]; then
  [[ -d "$ROOT/.venv" ]] || "$PY" -m venv "$ROOT/.venv"
  # shellcheck disable=SC1091
  source "$ROOT/.venv/bin/activate"; PY="python"
fi
if ! "$PY" -c "import pandas, sklearn, numpy, requests, openpyxl" 2>/dev/null; then
  echo ">> Installing dependencies..."; "$PY" -m pip install --quiet -r "$ROOT/requirements.txt"
fi

echo ">> Official national run (ACS demographics + propensity + survey blend)"
ARGS=(--appa "$APPA" --year "$YEAR" --outdir "$OUTDIR")
[[ -n "$ZIP_DMA" ]] && ARGS+=(--zip-dma "$ZIP_DMA")
[[ -n "$CENSUS_KEY" ]] && ARGS+=(--census-key "$CENSUS_KEY")
"$PY" -m zip_msa_personas official "${ARGS[@]}"

echo
echo ">> Combined market-viability + vet-siting sheet (reliability-filtered)"
VARGS=(--enriched "$OUTDIR/enriched_national_official.csv"
       --distributions "$OUTDIR/persona_distributions.csv"
       --out "$OUTDIR/market_viability_vetsiting.csv")
[[ -n "$CENSUS_KEY" ]] && VARGS+=(--census-key "$CENSUS_KEY")
"$PY" -m zip_msa_personas viability "${VARGS[@]}"

echo
echo "DONE. Outputs in: $OUTDIR"
echo "  - enriched_national_official.csv  (every ZIP: persona, confidence, provenance, MSA/DMA)"
echo "  - persona_distributions.csv       (full 7-segment mix per ZIP)"
echo "  - coverage/                       (survey-anchored vs demographic-model split)"
echo "  - market_viability_vetsiting.csv  (+ .xlsx: per-MSA grade, value, income, demand, vet model)"
