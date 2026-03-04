#!/usr/bin/env bash
set -euo pipefail

# Anchors a job completion hash via OP_RETURN
# Requires: bitcoin-cli configured for your Luna node
# Usage: ./anchor-bitcoin.sh <job_hash>

JOB_HASH="${1:?Usage: anchor-bitcoin.sh <job_hash>}"

# Build OP_RETURN data
OP_RETURN_DATA=$(echo -n "SATS-AI:${JOB_HASH}" | xxd -p | tr -d '\n')

# Create raw transaction with OP_RETURN
TXID=$(bitcoin-cli sendtoaddress "" 0 "" "" false false 1 "UNSET" \
  "{\"data\":\"${OP_RETURN_DATA}\"}" true)

echo "Anchored to Bitcoin: ${TXID}"
echo "Hash: ${JOB_HASH}"
