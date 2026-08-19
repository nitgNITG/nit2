#!/usr/bin/env bash
# ============================================================================
#  update-site.sh — refresh a live academy's code: pull its client/<slug> branch
#  inside the container, run any pending upgrade, purge caches. Use after new code
#  is merged into the academy's branch (e.g. after a saas-demo push).
#
#  Usage:   bash update-site.sh <slug>
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash update-site.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

log "pulling latest code for $SLUG"
docker exec "$CONTAINER" git -C /var/www/html pull --ff-only || die "git pull failed (branch may have diverged inside the container)"

log "running upgrade (picks up any new plugin versions)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/upgrade.php --non-interactive || echo "!! upgrade step reported an issue (site still up)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "done"
