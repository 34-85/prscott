#!/usr/bin/env bash
#
# run_local.sh -- one-command local pipeline for the APPA pet-owner persona product.
#
# Chains: ingest-appa -> fetch reference data -> calibrate -> national (MSA, and
# DMA if a crosswalk is given) -> validate -> rights-safe export.
#
# Run this on a machine with normal internet access (HUD + Census are reachable),
# NOT inside a sandbox that allowlists hosts. Your proprietary NPOS data never
# leaves your machine.
#
# Usage:
#   scripts/run_local.sh --appa NPOS_zip_by_segment.xlsx \
#       [--zip-dma your_licensed_zip_dma.csv] \
#       [--outdir ./out_local] [--alpha 5] [--k 10] \
#       [--vintage "NPOS2025;ACS2022;HUD2023Q4"] [--venv]
#
set -euo pipefail

# --- locate repo root (this script lives in <root>/scripts) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# --- defaults ---
APPA=""; ZIP_DMA=""; OUTDIR="$ROOT/out_local"; ALPHA="5"; K="10"
VINTAGE="NPOS2025;ACS2022;HUD2023Q4"; USE_VENV="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --appa)    APPA="$2"; shift 2;;
    --zip-dma) ZIP_DMA="$2"; shift 2;;
    --outdir)  OUTDIR="$2"; shift 2;;
    --alpha)   ALPHA="$2"; shift 2;;
    --k)       K="$2"; shift 2;;
    --vintage) VINTAGE="$2"; shift 2;;
    --venv)    USE_VENV="1"; shift;;
    -h|--help) sed -n '2,20p' "$0"; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 64;;
  esac
done

if [[ -z "$APPA" ]]; then
  echo "ERROR: --appa <NPOS workbook .xlsx> is required." >&2
  exit 64
fi
if [[ ! -f "$APPA" ]]; then
  echo "ERROR: APPA workbook not found: $APPA" >&2
  exit 66
fi

# --- python environment ---
PY="python3"
if [[ "$USE_VENV" == "1" ]]; then
  [[ -d "$ROOT/.venv" ]] || "$PY" -m venv "$ROOT/.venv"
  # shellcheck disable=SC1091
  source "$ROOT/.venv/bin/activate"
  PY="python"
fi
if ! "$PY" -c "import pandas, sklearn, numpy, requests, openpyxl" 2>/dev/null; then
  echo ">> Installing dependencies..."
  "$PY" -m pip install --quiet -r "$ROOT/requirements.txt"
fi

mkdir -p "$OUTDIR"
ZMP() { "$PY" -m zip_msa_personas "$@"; }

echo "============================================================"
echo " APPA persona pipeline (local)"
echo "   repo:     $ROOT"
echo "   appa:     $APPA"
echo "   zip->dma: ${ZIP_DMA:-<none>}"
echo "   outdir:   $OUTDIR"
echo "   vintage:  $VINTAGE   alpha=$ALPHA  k=$K"
echo "============================================================"

PERSONAS="$OUTDIR/appa_personas.csv"
CALIB="$OUTDIR/calibrator.json"
ENR_MSA="$OUTDIR/enriched_national_msa.csv"
ENR_DMA="$OUTDIR/enriched_national_dma.csv"

echo; echo ">> [1/6] Ingest APPA NPOS workbook -> tidy personas"
ZMP ingest-appa --input "$APPA" --out "$PERSONAS"

echo; echo ">> [2/6] Fetch + cache reference data (HUD ZIP-CBSA, CBSA delineation, ACS)"
if ! ZMP data; then
  echo "ERROR: could not fetch HUD/Census reference data." >&2
  echo "       Run on a machine with internet access to census.gov + huduser.gov." >&2
  exit 2
fi

echo; echo ">> [3/6] Fit isotonic confidence calibrator"
ZMP calibrate --personas "$PERSONAS" --k "$K" --out "$CALIB"

echo; echo ">> [4/6] National scoring -- MSA geography"
ZMP national --personas "$PERSONAS" --market msa \
  --calibrator "$CALIB" --shrink-alpha "$ALPHA" --k "$K" \
  --data-vintage "$VINTAGE" --out "$ENR_MSA"

if [[ -n "$ZIP_DMA" ]]; then
  echo; echo ">> [4b] National scoring -- DMA geography"
  ZMP national --personas "$PERSONAS" --market dma --zip-dma "$ZIP_DMA" \
    --calibrator "$CALIB" --shrink-alpha "$ALPHA" --k "$K" \
    --data-vintage "$VINTAGE" --out "$ENR_DMA"
fi

echo; echo ">> [5/6] Calibration / accuracy report (saved)"
ZMP validate --personas "$PERSONAS" --k "$K" | tee "$OUTDIR/validation_report.txt"

echo; echo ">> [6/6] Rights-safe export (resellable fields only) + manifest"
ZMP export --input "$ENR_MSA" --out "$OUTDIR/deliverable_msa.csv"
[[ -n "$ZIP_DMA" ]] && ZMP export --input "$ENR_DMA" --out "$OUTDIR/deliverable_dma.csv"

echo
echo "============================================================"
echo " DONE. Outputs in: $OUTDIR"
echo "   - appa_personas.csv          (tidy ingested personas)"
echo "   - calibrator.json            (fitted confidence calibrator)"
echo "   - enriched_national_msa.csv  (all scored ZIPs, MSA)"
[[ -n "$ZIP_DMA" ]] && echo "   - enriched_national_dma.csv  (all scored ZIPs, DMA)"
echo "   - *_coverage/                (coverage report CSVs)"
echo "   - validation_report.txt      (accuracy by confidence band)"
echo "   - deliverable_msa.csv (+ .manifest.json)   <- sellable file"
[[ -n "$ZIP_DMA" ]] && echo "   - deliverable_dma.csv (+ .manifest.json)"
echo "============================================================"
