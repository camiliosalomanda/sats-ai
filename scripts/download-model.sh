#!/usr/bin/env bash
set -euo pipefail

MODEL_REPO="${1:-lmstudio-community/Llama-3.2-3B-Instruct-GGUF}"
QUANT="${2:-Q4_K_M}"
OUTPUT_DIR="${3:-./models}"

echo "Downloading ${MODEL_REPO} (${QUANT})..."
mkdir -p "$OUTPUT_DIR"

pip install huggingface-hub --quiet 2>/dev/null

huggingface-cli download "$MODEL_REPO" \
  --include "*${QUANT}*.gguf" \
  --local-dir "$OUTPUT_DIR"

echo "Model downloaded to ${OUTPUT_DIR}"
ls -lh "$OUTPUT_DIR"/*.gguf
