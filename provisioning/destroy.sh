#!/usr/bin/env bash
# ============================================================================
#  destroy.sh — tear ONE client academy down on server B (reverse of create.sh
#  + bind-domain.sh).
#
#  Removes everything those scripts set up for a client:
#    0) its videos on the shared VdoCipher/Vimeo accounts (needs the container)
#    1) stop + remove the container   2) drop the database + its user
#    3) delete code + moodledata      4) disable + delete the Apache vhosts —
#       the subdomain's AND a bound custom domain's (the custom one proxies to
#       the container's port, which the next new academy may get: left behind,
#       the old domain would serve someone else's site)
#    5) reload apache                 6) delete the SSL certs, the apache logs,
#       the staging dir and the provisioning log
#
#  Usage:   sudo bash destroy.sh <slug> [custom-domain]
#  The custom domain is read from clients/<slug>/domain-status.json; the
#  argument (nit2 passes Tenant.customDomain) is the fallback when that is gone.
#
#  Idempotent: every step is guarded, so a half-provisioned or already-partly-
#  removed client still cleans up whatever is left — a MISSING piece is skipped.
#  A step that FAILS on something that is there is recorded, the rest still runs,
#  and the script exits 1 at the end, so the caller (provision-server.py → nit2)
#  knows the teardown is incomplete and keeps the tenant until it is fixed.
# ============================================================================
set -uo pipefail   # NOT -e: we want cleanup to continue past a missing piece.

# ── Config (must match create.sh) ───────────────────────────────────────────
DOMAIN="academy2026.nitg-eg.com"
ROOT="${SAAS_ROOT:-/var/www/html/saas}"   # academies data dir (override with SAAS_ROOT)
DB_CONTAINER="saas_mariadb"
LOG_DIR="${PROVISION_LOG_DIR:-$ROOT/logs}"
STAGING_DIR="${PROVISION_STAGING_DIR:-$ROOT/staging}"
APACHE_LOG_DIR="${APACHE_LOG_DIR:-/var/log/apache2}"
SITES_DIR="${APACHE_SITES_DIR:-/etc/apache2/sites-available}"
# ────────────────────────────────────────────────────────────────────────────

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
FAILED=()
failed(){ echo "!! $*"; FAILED+=("$*"); }

SLUG="${1:-}"
ARG_DOMAIN="${2:-}"
[[ -n "$SLUG" ]] || die "Usage: sudo bash destroy.sh <slug> [custom-domain]"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "Invalid slug (lowercase letters/digits/hyphens, 3-40)."
DOMAIN_RE='^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
[[ -z "$ARG_DOMAIN" || "$ARG_DOMAIN" =~ $DOMAIN_RE ]] || die "Invalid custom domain '$ARG_DOMAIN'."

DB_NAME="moodle_${SLUG//-/_}"
DB_USER="$DB_NAME"   # per-academy DB user (create.sh derives it from the slug)
CONTAINER="saas_moodle_${SLUG}"
SUBDOMAIN="${SLUG}.${DOMAIN}"
CLIENT_DIR="$ROOT/clients/$SLUG"

# The bound custom domain — read BEFORE step 3 deletes domain-status.json.
CUSTOM=""
if [[ -f "$CLIENT_DIR/domain-status.json" ]]; then
    CUSTOM="$(sed -nE 's/.*"domain":"([^"]*)".*/\1/p' "$CLIENT_DIR/domain-status.json" 2>/dev/null | head -1)"
fi
[[ -z "$CUSTOM" ]] && CUSTOM="$ARG_DOMAIN"
if [[ -n "$CUSTOM" && ! "$CUSTOM" =~ $DOMAIN_RE ]]; then
    failed "domain-status.json holds an invalid domain '$CUSTOM' — its vhost was NOT removed"
    CUSTOM=""
fi
# Never touch the platform's own subdomain zone as a "custom" domain.
[[ "$CUSTOM" == *"$DOMAIN" ]] && CUSTOM=""

log "destroying client=$SLUG  subdomain=$SUBDOMAIN  custom=${CUSTOM:-none}  container=$CONTAINER  db=$DB_NAME"

# ── 0. Free the academy's videos from the SHARED external providers ──────────
# Runs INSIDE the container (needs Moodle's DB + plugin creds), so it MUST happen
# before the container is removed and the DB dropped. A stopped container (a
# crashed or suspended academy) is started for it — otherwise its paid video
# storage would leak. Skip with SAAS_SKIP_MEDIA_CLEANUP=1 (e.g. when the
# providers are down); a provider error is recorded but never blocks teardown.
CLEANUP_MEDIA_PHP="${CLEANUP_MEDIA_PHP:-/root/cleanup_external_media.php}"
if [[ "${SAAS_SKIP_MEDIA_CLEANUP:-0}" != "1" && -f "$CLEANUP_MEDIA_PHP" ]] \
        && docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
        log "starting the stopped container for the video cleanup"
        docker start "$CONTAINER" >/dev/null 2>&1 && sleep "${MEDIA_START_WAIT:-5}" || failed "could not start $CONTAINER — its VdoCipher/Vimeo videos were NOT deleted"
    fi
    if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
        log "deleting external videos (VDOCipher/Vimeo) before teardown"
        docker cp "$CLEANUP_MEDIA_PHP" "$CONTAINER:/var/www/moodledata/cleanup_external_media.php" >/dev/null 2>&1 \
            && docker exec "$CONTAINER" php /var/www/moodledata/cleanup_external_media.php \
            || failed "external media cleanup failed — check the academy's videos on VdoCipher/Vimeo"
        docker exec "$CONTAINER" rm -f /var/www/moodledata/cleanup_external_media.php >/dev/null 2>&1 || true
    fi
fi

# ── 1. Stop + remove the container ──────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    log "removing container $CONTAINER"
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || failed "failed to remove container $CONTAINER"
else
    log "container $CONTAINER not present — skipping"
fi

# ── 2. Drop the database ────────────────────────────────────────────────────
if [[ -f "$ROOT/saas.env" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT/saas.env"
fi
if [[ -n "${DB_ROOT_PW:-}" ]] && docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    log "dropping database $DB_NAME + its scoped user"
    # Drop the schema AND the per-academy user, so teardown leaves no orphaned
    # schema or dangling grant behind. The DROP USER targets only this academy's
    # own user ('moodle_<slug>'); the legacy shared 'moodle' user (still used by
    # older academies) is never touched.
    docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" >/dev/null 2>&1 <<SQL || failed "failed to drop database/user $DB_NAME"
DROP DATABASE IF EXISTS \`$DB_NAME\`;
DROP USER IF EXISTS '$DB_USER'@'%';
FLUSH PRIVILEGES;
SQL
else
    # Not "missing": the database may well exist — we just could not reach it.
    failed "shared DB unavailable or DB_ROOT_PW unset — database $DB_NAME was NOT dropped"
fi

# ── 3. Delete code + moodledata ─────────────────────────────────────────────
if [[ -d "$CLIENT_DIR" ]]; then
    log "removing $CLIENT_DIR"
    rm -rf "$CLIENT_DIR" || failed "failed to remove $CLIENT_DIR"
else
    log "$CLIENT_DIR not present — skipping"
fi

# ── 4. Disable + delete the Apache vhosts (subdomain + custom domain) ───────
CHANGED=0
SITES=("${SUBDOMAIN}.conf" "${SUBDOMAIN}-le-ssl.conf")
[[ -n "$CUSTOM" ]] && SITES+=("${CUSTOM}.conf" "${CUSTOM}-le-ssl.conf")
for conf in "${SITES[@]}"; do
    if [[ -f "$SITES_DIR/$conf" ]]; then
        log "disabling apache site $conf"
        a2dissite "$conf" >/dev/null 2>&1 || echo "!! a2dissite $conf failed (maybe already disabled)"
        rm -f "$SITES_DIR/$conf" || failed "failed to remove vhost $conf"
        CHANGED=1
    fi
done

# ── 5. Reload apache (only if something changed and config is valid) ─────────
if [[ "$CHANGED" == "1" ]]; then
    if apache2ctl configtest >/dev/null 2>&1; then
        log "reloading apache"
        systemctl reload apache2 || failed "apache reload failed — the removed vhosts may still be served"
    else
        failed "apache configtest failed — NOT reloading; inspect config manually"
    fi
fi

# ── 6. SSL certs, apache logs, staging, provisioning log ────────────────────
if command -v certbot >/dev/null 2>&1; then
    CERTS="$(certbot certificates 2>/dev/null || true)"
    for cert in "$SUBDOMAIN" ${CUSTOM:+"$CUSTOM"}; do
        if grep -q "Certificate Name: ${cert}\$" <<<"$CERTS"; then
            log "deleting SSL certificate for $cert"
            certbot delete --cert-name "$cert" --non-interactive >/dev/null 2>&1 \
                || failed "certbot delete failed for $cert"
        fi
    done
fi
# <slug>_error.log, <slug>_access.log, <slug>_custom_*.log (+ rotated .1/.gz).
# Slugs cannot contain "_", so "<slug>_" can never match another academy's logs.
rm -f "$APACHE_LOG_DIR/${SLUG}_"*.log "$APACHE_LOG_DIR/${SLUG}_"*.log.* 2>/dev/null || true
rm -f "$LOG_DIR/${SLUG}.log" 2>/dev/null || true
rm -rf "${STAGING_DIR:?}/$SLUG" 2>/dev/null || true

echo ""
echo "============================================================"
if [[ ${#FAILED[@]} -eq 0 ]]; then
    echo "  '$SLUG' destroyed:  container, db, files, vhosts, certs removed"
    echo "============================================================"
    exit 0
fi
echo "  '$SLUG' NOT fully destroyed — ${#FAILED[@]} step(s) failed:"
for f in "${FAILED[@]}"; do echo "    - $f"; done
echo "  Fix the cause and run it again (it is safe to re-run)."
echo "============================================================"
exit 1
