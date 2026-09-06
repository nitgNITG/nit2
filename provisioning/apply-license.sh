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
# Dynamic licence definition (JSON) from the control plane — limits/features live
# here now; empty clears it so local_license falls back to its built-in default.
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=definition --set="${LICENSE_DEFINITION:-}"
# Storage quota (GB) — parsed out of the licence definition JSON and stored as a
# plain cfg so saas-quota.sh can read it per academy without JSON-parsing.
STORAGE_GB="$(python3 -c 'import json,os; d=json.loads(os.environ.get("LICENSE_DEFINITION") or "{}"); v=d.get("storagegb"); print(int(v) if str(v).lstrip("-").isdigit() and int(v)>0 else "")' 2>/dev/null || true)"
if [[ -n "$STORAGE_GB" ]]; then
    log "storage quota -> ${STORAGE_GB}G"
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=storagegb --set="$STORAGE_GB" >/dev/null 2>&1 || true
fi
# Per-academy expiry date (YYYY-MM-DD) → local_license/expirydate so the academy
# shows the renewal banner. Only when present in the definition (create / renewal
# / plan change) — a plain reapply omits it and leaves the expiry as-is.
EXPIRY_DATE="$(python3 -c 'import json,os; d=json.loads(os.environ.get("LICENSE_DEFINITION") or "{}"); print(d.get("expirydate") or "")' 2>/dev/null || true)"
if [[ -n "$EXPIRY_DATE" ]]; then
    log "expiry date -> ${EXPIRY_DATE}"
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=expirydate --set="$EXPIRY_DATE" >/dev/null 2>&1 || true
fi
# Renew link for the banner (global — the nit2 account page).
RENEW_URL="$(python3 -c 'import json,os; d=json.loads(os.environ.get("LICENSE_DEFINITION") or "{}"); print(d.get("renewurl") or "")' 2>/dev/null || true)"
if [[ -n "$RENEW_URL" ]]; then
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=renewurl --set="$RENEW_URL" >/dev/null 2>&1 || true
fi
docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "done"
