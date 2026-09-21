#!/usr/bin/env bash
# ============================================================================
#  update-image.sh <slug> <tag> — move ONE store to an image tag. Compose
#  recreates only the services whose image actually changed (a dashboard-only
#  release never restarts the storefront). The api's entrypoint runs
#  `prisma migrate deploy` before serving. A store pinned with
#  clients/<slug>/pin is skipped unless FORCE=1.
# ============================================================================
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
trap 'on_error' ERR
store_paths "${1:-}"
TAG="${2:-}"
[[ -n "$TAG" ]] || die "usage: update-image.sh <slug> <tag>"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found"
if [[ -f "$CLIENT_DIR/pin" && "${FORCE:-0}" != "1" ]]; then
    log "$SLUG is pinned to $(cat "$CLIENT_DIR/pin") — skipping (FORCE=1 to override)"
    report_done "" '"skipped":"pinned"'
    exit 0
fi
TOTAL=3
report_step 1 $TOTAL "Pulling $TAG"
env_set "$ENV_FILE" IMAGE_TAG "$TAG"
compose pull -q 2>&1 | grep -v '^$' || true
report_step 2 $TOTAL "Recreating changed containers"
compose up -d --remove-orphans 2>&1 | grep -v '^$' || true
report_step 3 $TOTAL "Waiting for health"
P_API="$(env_get "$ENV_FILE" P_API)"
wait_api_health "$P_API" 120 || die "api not healthy after update to $TAG"
report_done "" "\"image_tag\":$(json_escape "$TAG")"
log "$SLUG → $TAG"
