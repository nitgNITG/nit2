#!/usr/bin/env bash
# reset-owner.sh <slug> [email] — new temporary owner password (+ e-mail). Prints the CLI JSON
# (it contains the password: nit2 encrypts and stores it; this host never writes it to disk).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found"
if [[ -n "${2:-}" ]]; then
    store_cli owner-reset --email "$2"
else
    store_cli owner-reset
fi
