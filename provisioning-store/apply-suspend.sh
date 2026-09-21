#!/usr/bin/env bash
# apply-suspend.sh <slug> on|off — flip the licence suspension (storefront 503, dashboard read-only).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found"
case "${2:-}" in
    on)  FLAG=--on ;;
    off) FLAG=--off ;;
    *)   die "usage: apply-suspend.sh <slug> on|off" ;;
esac
store_cli suspend "$FLAG"
