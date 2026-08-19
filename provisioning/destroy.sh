#!/usr/bin/env bash
# ============================================================================
#  destroy.sh — tear ONE client academy down on server B (reverse of create.sh).
#
#  Removes everything create.sh set up for a client:
#    1) stop + remove the container   2) drop the database
#    3) delete code + moodledata      4) disable + delete the Apache vhosts
#    5) reload apache                 6) (best-effort) delete the SSL cert + log
#
#  Usage:   sudo bash destroy.sh <slug>
#
#  Idempotent and best-effort: every step is guarded, so a half-provisioned or
#  already-partly-removed client still cleans up whatever is left. It never
#  aborts midway — a missing piece is logged and skipped, not treated as fatal.
# ============================================================================
set -uo pipefail   # NOT -e: we want cleanup to continue past a missing piece.

# ── Config (must match create.sh) ───────────────────────────────────────────
DOMAIN="academy2026.nitg-eg.com"
ROOT="/opt/saas"
DB_CONTAINER="saas_mariadb"
LOG_DIR="${PROVISION_LOG_DIR:-/opt/saas/logs}"
STAGING_DIR="${PROVISION_STAGING_DIR:-/opt/saas/staging}"
# ────────────────────────────────────────────────────────────────────────────

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: sudo bash destroy.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "Invalid slug (lowercase letters/digits/hyphens, 3-40)."

DB_NAME="moodle_${SLUG//-/_}"
CONTAINER="saas_moodle_${SLUG}"
SUBDOMAIN="${SLUG}.${DOMAIN}"
CLIENT_DIR="$ROOT/clients/$SLUG"
VHOST="/etc/apache2/sites-available/${SUBDOMAIN}.conf"
VHOST_SSL="/etc/apache2/sites-available/${SUBDOMAIN}-le-ssl.conf"

log "destroying client=$SLUG  subdomain=$SUBDOMAIN  container=$CONTAINER  db=$DB_NAME"

# ── 1. Stop + remove the container ──────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    log "removing container $CONTAINER"
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || echo "!! failed to remove container $CONTAINER"
else
    log "container $CONTAINER not present — skipping"
fi

# ── 2. Drop the database ────────────────────────────────────────────────────
if [[ -f "$ROOT/saas.env" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT/saas.env"
fi
if [[ -n "${DB_ROOT_PW:-}" ]] && docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    log "dropping database $DB_NAME"
    docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" \
        -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;" >/dev/null 2>&1 \
        || echo "!! failed to drop database $DB_NAME"
else
    log "shared DB unavailable or DB_ROOT_PW unset — skipping database drop"
fi

# ── 3. Delete code + moodledata ─────────────────────────────────────────────
if [[ -d "$CLIENT_DIR" ]]; then
    log "removing $CLIENT_DIR"
    rm -rf "$CLIENT_DIR" || echo "!! failed to remove $CLIENT_DIR"
else
    log "$CLIENT_DIR not present — skipping"
fi

# ── 4. Disable + delete the Apache vhosts ───────────────────────────────────
CHANGED=0
for conf in "${SUBDOMAIN}.conf" "${SUBDOMAIN}-le-ssl.conf"; do
    if [[ -f "/etc/apache2/sites-available/$conf" ]]; then
        log "disabling apache site $conf"
        a2dissite "$conf" >/dev/null 2>&1 || echo "!! a2dissite $conf failed (maybe already disabled)"
        rm -f "/etc/apache2/sites-available/$conf" || echo "!! failed to remove $conf"
        CHANGED=1
    fi
done

# ── 5. Reload apache (only if something changed and config is valid) ─────────
if [[ "$CHANGED" == "1" ]]; then
    if apache2ctl configtest >/dev/null 2>&1; then
        log "reloading apache"
        systemctl reload apache2 || echo "!! apache reload failed"
    else
        echo "!! apache configtest failed — NOT reloading; inspect config manually"
    fi
fi

# ── 6. Best-effort: delete the SSL certificate + provisioning log ───────────
if command -v certbot >/dev/null 2>&1 && certbot certificates 2>/dev/null | grep -q "Certificate Name: $SUBDOMAIN"; then
    log "deleting SSL certificate for $SUBDOMAIN"
    certbot delete --cert-name "$SUBDOMAIN" --non-interactive >/dev/null 2>&1 \
        || echo "!! certbot delete failed for $SUBDOMAIN"
fi
rm -f "$LOG_DIR/${SLUG}.log" 2>/dev/null || true
rm -rf "${STAGING_DIR:?}/$SLUG" 2>/dev/null || true

echo ""
echo "============================================================"
echo "  '$SLUG' destroyed:  container, db, files, vhosts removed"
echo "============================================================"
