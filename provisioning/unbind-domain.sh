#!/usr/bin/env bash
# ============================================================================
#  unbind-domain.sh — remove a custom domain from an academy and revert its
#  canonical URL to the <slug>.<base> subdomain. Phase 2.
#
#  Reverts $CFG->wwwroot to the subdomain, purges caches, disables + removes the
#  custom vhost, and clears the status marker. Leaves the issued cert in place
#  (harmless; certbot can prune it later). Reads the domain from domain-status.json
#  if not passed.
#
#  Usage:  bash unbind-domain.sh <slug> [domain]
# ============================================================================
set -uo pipefail

DOMAIN_BASE="${SAAS_CLIENT_DOMAIN:-academy2026.nitg-eg.com}"
ROOT="${SAAS_ROOT:-/var/www/html/saas}"
log(){ echo "==> $*"; }

SLUG="${1:-}"; CUSTOM="${2:-}"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || { echo "invalid slug" >&2; exit 1; }
CLIENT_DIR="$ROOT/clients/$SLUG"
STATUS="$CLIENT_DIR/domain-status.json"
CONF="$CLIENT_DIR/config.php"
CONTAINER="saas_moodle_${SLUG}"
SUBDOMAIN="${SLUG}.${DOMAIN_BASE}"

# Recover the domain from the status file when not given.
if [[ -z "$CUSTOM" && -f "$STATUS" ]]; then
    CUSTOM="$(sed -E 's/.*"domain":"([^"]*)".*/\1/' "$STATUS" 2>/dev/null || true)"
fi

if [[ -f "$CONF" ]]; then
    log "wwwroot -> https://$SUBDOMAIN"
    # In-place edit (preserve inode) — the container bind-mounts config.php by inode,
    # so `sed -i` (which renames a new file in) would be invisible to it.
    _tmp="$(mktemp)"
    sed "s|\$CFG->wwwroot .*|\$CFG->wwwroot   = 'https://$SUBDOMAIN';|" "$CONF" > "$_tmp" && cat "$_tmp" > "$CONF"
    rm -f "$_tmp"
    docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php >/dev/null 2>&1 || true
fi

if [[ -n "$CUSTOM" ]]; then
    a2dissite "${CUSTOM}.conf" >/dev/null 2>&1 || true
    rm -f "/etc/apache2/sites-available/${CUSTOM}.conf"
    apache2ctl configtest >/dev/null 2>&1 && systemctl reload apache2 || true
fi

rm -f "$STATUS"
log "done — $SLUG reverted to $SUBDOMAIN"
