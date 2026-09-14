#!/usr/bin/env bash
# ============================================================================
#  bind-domain.sh — bind a customer's OWN domain to a live academy and make it
#  the canonical URL. Phase 2 of the SaaS platform (owner self-serve).
#
#  Steps: add an Apache reverse-proxy vhost for <domain> -> the academy's
#  container, issue a Let's Encrypt cert (certbot), then point Moodle's
#  $CFG->wwwroot at <domain> and purge caches. The <slug>.<base> subdomain keeps
#  proxying, so Moodle now 301-redirects it to the canonical custom domain.
#
#  DNS must already point <domain> at this host (nit2 verifies before calling;
#  certbot's HTTP-01 re-checks). Writes the outcome to the academy's
#  domain-status.json so nit2 can report it.
#
#  Usage:  bash bind-domain.sh <slug> <domain>
# ============================================================================
set -uo pipefail

DOMAIN_BASE="${SAAS_CLIENT_DOMAIN:-academy2026.nitg-eg.com}"
ROOT="${SAAS_ROOT:-/var/www/html/saas}"
LE_EMAIL="${LE_EMAIL:-admin@nitg-eg.com}"

log(){ echo "==> $*"; }

SLUG="${1:-}"; CUSTOM="${2:-}"
CLIENT_DIR="$ROOT/clients/$SLUG"
STATUS="$CLIENT_DIR/domain-status.json"
CONF="$CLIENT_DIR/config.php"
CONTAINER="saas_moodle_${SLUG}"
SUBDOMAIN="${SLUG}.${DOMAIN_BASE}"
VHOST="/etc/apache2/sites-available/${CUSTOM}.conf"

# Record the outcome for nit2 (state = verifying|active|failed).
write_status(){ # $1=state  $2=error
    mkdir -p "$CLIENT_DIR"
    printf '{"state":"%s","domain":"%s","error":"%s","at":%s}\n' \
        "$1" "$CUSTOM" "${2//\"/\'}" "$(date +%s)" > "$STATUS"
}
fail(){ echo "ERROR: $*" >&2; write_status "failed" "$*"; exit 1; }

[[ -n "$SLUG" && -n "$CUSTOM" ]] || fail "usage: bind-domain.sh <slug> <domain>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || fail "invalid slug"
[[ "$CUSTOM" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || fail "invalid domain"
[[ "$CUSTOM" == *"$DOMAIN_BASE" ]] && fail "refusing to bind a managed subdomain"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || fail "container $CONTAINER not running"
[[ -f "$CONF" ]] || fail "config.php not found for $SLUG"

write_status "verifying" ""

# Which host port does this academy's container publish (127.0.0.1:PORT->80)?
PORT="$(docker port "$CONTAINER" 80 2>/dev/null | sed -E 's/.*:([0-9]+)$/\1/' | head -1)"
[[ -n "$PORT" ]] || fail "could not determine container port"

log "vhost for $CUSTOM -> 127.0.0.1:$PORT"
cat > "$VHOST" <<APACHE
<VirtualHost *:80>
    ServerName $CUSTOM
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:$PORT/
    ProxyPassReverse / http://127.0.0.1:$PORT/
    RequestHeader set X-Forwarded-Proto "https"
    ErrorLog \${APACHE_LOG_DIR}/${SLUG}_custom_error.log
    CustomLog \${APACHE_LOG_DIR}/${SLUG}_custom_access.log combined
</VirtualHost>
APACHE
a2ensite "${CUSTOM}.conf" >/dev/null || fail "a2ensite failed"
apache2ctl configtest || fail "apache configtest failed"
systemctl reload apache2 || fail "apache reload failed"

log "certbot for $CUSTOM"
certbot --apache -d "$CUSTOM" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect \
    || fail "certbot failed for $CUSTOM (does it resolve here and is port 80 open?)"
systemctl reload apache2 || true

# Make the custom domain canonical. $CFG->wwwroot is read from config.php on every
# request, so rewriting the host + purging caches is enough; the subdomain vhost
# stays, and Moodle now 301s it to this wwwroot.
log "wwwroot -> https://$CUSTOM"
sed -i "s|\$CFG->wwwroot .*|\$CFG->wwwroot   = 'https://$CUSTOM';|" "$CONF" \
    || fail "could not update wwwroot"
docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php >/dev/null 2>&1 || true

write_status "active" ""
log "done — $CUSTOM is now canonical for $SLUG"
