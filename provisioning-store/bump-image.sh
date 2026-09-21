#!/usr/bin/env bash
# ============================================================================
#  bump-image.sh <tag> --all — roll every store to <tag> (CI calls
#  POST /update-image after pushing the images). Pulls the three images once,
#  then updates stores one by one; a failing store is logged and skipped.
#  Pinned stores (clients/<slug>/pin) are left alone. Telegram summary at the end.
#  No service restart is involved (unlike the academy rollout).
# ============================================================================
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
TAG="${1:-}"; MODE="${2:-}"
[[ -n "$TAG" && "$MODE" == "--all" ]] || die "usage: bump-image.sh <tag> --all"
REGISTRY="${REGISTRY:-ghcr.io/nitgg}"

log "pulling $REGISTRY/saas-store-{api,site,dash}:$TAG"
for app in api site dash; do
    docker pull -q "$REGISTRY/saas-store-$app:$TAG" >/dev/null || die "pull failed for $app:$TAG"
done
# Stores created from now on get this tag too.
[[ -f "$STORE_ROOT/provision.env" ]] && env_set "$STORE_ROOT/provision.env" IMAGE_TAG "$TAG"

OK=(); FAILED=(); SKIPPED=()
for envf in "$STORE_ROOT"/clients/*/store.env; do
    [[ -f "$envf" ]] || continue
    slug="$(basename "$(dirname "$envf")")"
    if [[ -f "$(dirname "$envf")/pin" ]]; then SKIPPED+=("$slug"); continue; fi
    log "----- $slug"
    if STORE_JOB= bash "$SCRIPTS_DIR/update-image.sh" "$slug" "$TAG"; then OK+=("$slug"); else FAILED+=("$slug"); fi
done
SUMMARY="🛒 stores → $TAG: ok=${#OK[@]} failed=${#FAILED[@]} pinned=${#SKIPPED[@]}"
[[ ${#FAILED[@]} -gt 0 ]] && SUMMARY="$SUMMARY · failed: ${FAILED[*]}"
log "$SUMMARY"
telegram "$SUMMARY"
[[ ${#FAILED[@]} -eq 0 ]]
