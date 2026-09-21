#!/usr/bin/env bash
# ============================================================================
#  proxy.sh — the host web-server adapter. One hostname per store, three paths:
#      /  → site      /dashboard → dash      /apis → api
#
#    proxy.sh add    <slug> <host> <p_site> <p_dash> <p_api>   render + test + reload (+ TLS)
#    proxy.sh remove <slug> <host>                             disable + delete (+ cert)
#
#  PROXY=nginx|apache|none (provision.env; none = another layer routes to the
#  host ports, nothing is written here). Config changes are applied with a
#  RELOAD, never a restart, so other stores (and nit2 on the same box) never
#  blink. TLS_MODE=per-host issues a Let's Encrypt cert with certbot's
#  nginx/apache plugin (HTTP-01 — the wildcard A record must point here);
#  TLS_MODE=none leaves port 80 only (another terminator in front).
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY="${PROXY:-nginx}"
TLS_MODE="${TLS_MODE:-per-host}"
LE_EMAIL="${LE_EMAIL:-admin@nitg-eg.com}"

log(){ echo "==> [proxy] $*"; }
die(){ echo "ERROR: [proxy] $*" >&2; exit 1; }

ACTION="${1:-}"; SLUG="${2:-}"; HOST="${3:-}"
[[ -n "$ACTION" && -n "$SLUG" && -n "$HOST" ]] || die "usage: proxy.sh add|remove <slug> <host> [ports]"

render(){ # $1=template → stdout
    sed -e "s|{HOST}|$HOST|g" -e "s|{SLUG}|$SLUG|g" \
        -e "s|{P_SITE}|${P_SITE}|g" -e "s|{P_DASH}|${P_DASH}|g" -e "s|{P_API}|${P_API}|g" "$1"
}

nginx_add(){
    local conf="/etc/nginx/conf.d/saas-store-${HOST}.conf"
    render "$HERE/nginx.conf.tmpl" > "$conf"
    nginx -t >/dev/null || { rm -f "$conf"; die "nginx config test failed for $HOST"; }
    systemctl reload nginx
    if [[ "$TLS_MODE" == "per-host" ]]; then
        log "requesting certificate for $HOST"
        certbot --nginx -d "$HOST" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect --keep-until-expiring \
            || echo "!! certbot failed for $HOST — check DNS (*.${HOST#*.} → this host) and port 80; site is up on http"
        systemctl reload nginx
    fi
}
nginx_remove(){
    rm -f "/etc/nginx/conf.d/saas-store-${HOST}.conf"
    nginx -t >/dev/null && systemctl reload nginx || echo "!! nginx reload failed after removing $HOST"
    certbot delete --cert-name "$HOST" --non-interactive >/dev/null 2>&1 || true
}

apache_add(){
    local conf="/etc/apache2/sites-available/${HOST}.conf"
    render "$HERE/apache.conf.tmpl" > "$conf"
    a2enmod proxy proxy_http headers >/dev/null 2>&1 || true
    a2ensite "${HOST}.conf" >/dev/null
    apache2ctl configtest >/dev/null 2>&1 || { a2dissite "${HOST}.conf" >/dev/null; rm -f "$conf"; die "apache configtest failed for $HOST"; }
    systemctl reload apache2
    if [[ "$TLS_MODE" == "per-host" ]]; then
        log "requesting certificate for $HOST"
        certbot --apache -d "$HOST" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect --keep-until-expiring \
            || echo "!! certbot failed for $HOST — check DNS (*.${HOST#*.} → this host) and port 80; site is up on http"
        systemctl reload apache2
    fi
}
apache_remove(){
    for conf in "${HOST}.conf" "${HOST}-le-ssl.conf"; do
        [[ -f "/etc/apache2/sites-available/$conf" ]] || continue
        a2dissite "$conf" >/dev/null 2>&1 || true
        rm -f "/etc/apache2/sites-available/$conf"
    done
    apache2ctl configtest >/dev/null 2>&1 && systemctl reload apache2 || echo "!! apache reload failed after removing $HOST"
    certbot delete --cert-name "$HOST" --non-interactive >/dev/null 2>&1 || true
}

if [[ "$PROXY" == "none" ]]; then
    log "PROXY=none — skipping $ACTION for $HOST"
    exit 0
fi

case "$ACTION" in
    add)
        P_SITE="${4:-}"; P_DASH="${5:-}"; P_API="${6:-}"
        [[ -n "$P_SITE" && -n "$P_DASH" && -n "$P_API" ]] || die "add needs <p_site> <p_dash> <p_api>"
        log "adding $HOST → site:$P_SITE dash:$P_DASH api:$P_API ($PROXY, tls=$TLS_MODE)"
        [[ "$PROXY" == "apache" ]] && apache_add || nginx_add ;;
    remove)
        log "removing $HOST ($PROXY)"
        [[ "$PROXY" == "apache" ]] && apache_remove || nginx_remove ;;
    *) die "unknown action $ACTION" ;;
esac
