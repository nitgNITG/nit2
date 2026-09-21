#!/usr/bin/env bash
# apply-license.sh <slug>  — stdin: the licence JSON ({tier, definition, expires_at, …}).
# Pushes a new plan / term to a live store through `cli license`. Synchronous (~1 s).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found"
LIC="$(cat)"
[[ -n "$LIC" ]] || die "licence JSON expected on stdin"
OUT="$(store_cli license --file - <<<"$LIC")" || { echo "$OUT"; die "cli license failed"; }
echo "$OUT"
