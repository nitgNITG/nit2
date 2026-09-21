#!/usr/bin/env bash
# reset-owner.sh <slug> [email] [--platform] — new temporary owner password (+ e-mail). Prints the CLI JSON
# (it contains the password: nit2 encrypts and stores it; this host never writes it to disk).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found"
ARGS=()
[[ -n "${2:-}" ]] && ARGS+=(--email "$2")
[[ "${3:-}" == "--platform" ]] && ARGS+=(--platform)   # the hidden NIT support login (created if missing)
store_cli owner-reset "${ARGS[@]}"
