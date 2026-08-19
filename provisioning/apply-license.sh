#!/usr/bin/env bash
# ============================================================================
#  apply-license.sh — set/change the local_license tier on an ALREADY-provisioned
#  academy (no re-provision). Used when an admin changes a plan in the dashboard.
#
#  Usage:   bash apply-license.sh <slug> <tier>
#           tier ∈ demo | basic | standard | professional
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
TIER="${2:-demo}"
[[ -n "$SLUG" ]] || die "Usage: bash apply-license.sh <slug> <tier>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"
case "$TIER" in demo|basic|standard|professional) ;; *) TIER="demo" ;; esac

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

log "apply-license $SLUG -> tier=$TIER (enforcement on)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=tier    --set="$TIER"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=enabled --set=1
docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "done"
