#!/usr/bin/env bash
# ============================================================================
#  apply-suspend.sh — soft-lock (suspend) or unlock (resume) a live academy.
#  Sets local_license/suspended; local_license then locks the whole site to a
#  "suspended" notice regardless of tier. Data is preserved — fully reversible.
#
#  Usage:   bash apply-suspend.sh <slug> <0|1>     (1 = suspend, 0 = resume)
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
STATE="${2:-1}"
[[ -n "$SLUG" ]] || die "Usage: bash apply-suspend.sh <slug> <0|1>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"
[[ "$STATE" == "0" || "$STATE" == "1" ]] || STATE=1

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

log "set local_license/suspended=$STATE for $SLUG"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=suspended --set="$STATE"
docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "done ($([ "$STATE" = 1 ] && echo suspended || echo resumed))"
