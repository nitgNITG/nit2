#!/usr/bin/env bash
# ============================================================================
#  setup.sh — install the STORE provisioner on any Ubuntu host (22.04 / 24.04).
#  Idempotent: re-run after pulling new scripts; values already in
#  provision.env are preserved (same precedence rules as the academy
#  setup-provision.sh: exported var > existing provision.env > default).
#
#    sudo -E bash setup.sh
#
#  What it does: Docker (if missing) · saas_net network · shared MariaDB
#  (created, or reused when saas_mariadb already runs — the academy box) ·
#  /var/www/html/saas-stores/{clients,logs,staging} + scripts · provision.env ·
#  docker login to GHCR + image pre-pull · host web server detection (nginx/apache)
#  · certbot · systemd service on 127.0.0.1:9098.
#
#  It does NOT touch the host web server's ports or vhosts: stores get their own
#  vhost files at creation (proxy/proxy.sh), reloaded, never restarted.
# ============================================================================
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ $EUID -eq 0 ]] || { echo "run as root (sudo -E bash setup.sh)"; exit 1; }

STORE_ROOT="${STORE_ROOT:-/var/www/html/saas-stores}"
ENVF="$STORE_ROOT/provision.env"
_keep(){ [[ -f "$ENVF" ]] && sed -n "s/^$1=//p" "$ENVF" | tail -1 || true; }
_val(){ # NAME DEFAULT → exported var > provision.env > default
    local name="$1" def="${2:-}" cur
    cur="${!name:-}"; [[ -n "$cur" ]] || cur="$(_keep "$name")"; [[ -n "$cur" ]] || cur="$def"
    printf '%s' "$cur"
}
log(){ echo "==> $*"; }

# ── 1. Packages: docker, python3, curl, certbot, ss ─────────────────────────
# apt is only touched when something is actually missing, so a re-run on a box
# that already has everything never waits on the apt/dpkg lock (unattended
# upgrades run whenever they like).
export DEBIAN_FRONTEND=noninteractive
_apt_updated=0
apt_install(){ # packages...
    if [[ "$_apt_updated" == 0 ]]; then
        log "apt: installing $*"
        if fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; then
            log "waiting for another apt/dpkg process to finish"
            while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock >/dev/null 2>&1; do sleep 5; done
        fi
        apt-get update -qq; _apt_updated=1
    fi
    apt-get install -y -qq "$@" >/dev/null
}
missing=()
for c in curl python3 ss openssl fuser; do command -v "$c" >/dev/null 2>&1 || missing+=("$c"); done
if ((${#missing[@]})); then
    log "packages missing: ${missing[*]}"
    apt_install ca-certificates curl python3 iproute2 openssl psmisc
else
    log "packages: curl python3 ss openssl present — apt not needed"
fi
if ! command -v docker >/dev/null 2>&1; then
    log "installing docker"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list
    apt_install docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
# Compose v2 + BuildKit (buildx). Package names differ between Docker's own repo
# (docker-compose-plugin / docker-buildx-plugin) and Ubuntu's docker.io
# (docker-compose-v2 / docker-buildx); fall back to the release binaries.
if ! docker compose version >/dev/null 2>&1; then
    apt_install docker-compose-plugin 2>/dev/null || apt_install docker-compose-v2 2>/dev/null || {
        log "installing docker compose plugin binary"
        mkdir -p /usr/local/lib/docker/cli-plugins
        curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    }
fi
if ! docker buildx version >/dev/null 2>&1; then
    apt_install docker-buildx-plugin 2>/dev/null || apt_install docker-buildx 2>/dev/null || {
        log "installing docker buildx plugin binary"
        mkdir -p /usr/local/lib/docker/cli-plugins
        arch="$(uname -m)"; [[ "$arch" == "x86_64" ]] && arch=amd64; [[ "$arch" == "aarch64" ]] && arch=arm64
        curl -fsSL "https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-${arch}" -o /usr/local/lib/docker/cli-plugins/docker-buildx
        chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
    }
fi
systemctl enable --now docker >/dev/null

# ── 2. Host web server (the stores' vhosts live in it) ──────────────────────
PROXY="$(_val PROXY "")"
if [[ -z "$PROXY" ]]; then
    if systemctl is-active --quiet nginx; then PROXY=nginx
    elif systemctl is-active --quiet apache2; then PROXY=apache
    else PROXY=nginx; log "no web server found — installing nginx"; apt_install nginx; systemctl enable --now nginx; fi
fi
log "proxy: $PROXY"
TLS_MODE="$(_val TLS_MODE per-host)"
if [[ "$TLS_MODE" == "per-host" ]]; then
    if ! command -v certbot >/dev/null 2>&1; then
        log "installing certbot"
        apt_install certbot "python3-certbot-$PROXY"
    elif ! certbot plugins 2>/dev/null | grep -q "^\* $PROXY"; then
        log "installing the certbot $PROXY plugin"
        apt_install "python3-certbot-$PROXY"
    fi
fi

# ── 3. Directories + scripts ────────────────────────────────────────────────
log "installing scripts to $STORE_ROOT"
mkdir -p "$STORE_ROOT"/{clients,logs,staging,proxy}
chmod 750 "$STORE_ROOT/clients"
for f in provision-server.py lib.sh create-store.sh destroy-store.sh apply-license.sh apply-suspend.sh \
         reset-owner.sh update-image.sh bump-image.sh bind-domain.sh unbind-domain.sh upload-image.sh compose.store.yml; do
    cp "$SRC/$f" "$STORE_ROOT/$f"
done
cp "$SRC"/proxy/* "$STORE_ROOT/proxy/"
chmod +x "$STORE_ROOT"/*.sh "$STORE_ROOT"/proxy/*.sh

# ── 4. Shared network + MariaDB ─────────────────────────────────────────────
docker network inspect saas_net >/dev/null 2>&1 || docker network create saas_net >/dev/null
DB_CONTAINER="$(_val SAAS_DB_CONTAINER saas_mariadb)"
DB_ROOT_PW="$(_val DB_ROOT_PW "")"
if docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    log "reusing existing $DB_CONTAINER"
    docker start "$DB_CONTAINER" >/dev/null 2>&1 || true
    docker network connect saas_net "$DB_CONTAINER" >/dev/null 2>&1 || true
    if [[ -z "$DB_ROOT_PW" && -f /var/www/html/saas/saas.env ]]; then
        DB_ROOT_PW="$(sed -n 's/^DB_ROOT_PW=//p' /var/www/html/saas/saas.env | tail -1)"   # the academy box
    fi
    [[ -n "$DB_ROOT_PW" ]] || echo "!! DB_ROOT_PW unknown — set it in $ENVF before creating stores"
else
    [[ -n "$DB_ROOT_PW" ]] || DB_ROOT_PW="$(openssl rand -hex 24)"
    log "creating $DB_CONTAINER (mariadb:11.4, 127.0.0.1:3308)"
    mkdir -p "$STORE_ROOT/mariadb"
    docker run -d --name "$DB_CONTAINER" --network saas_net --restart unless-stopped \
        -p 127.0.0.1:3308:3306 -e MARIADB_ROOT_PASSWORD="$DB_ROOT_PW" \
        -v "$STORE_ROOT/mariadb:/var/lib/mysql" mariadb:11.4 \
        --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --max-connections=500 >/dev/null
fi

# ── 5. provision.env (values preserved across re-runs) ─────────────────────
PROVISION_SECRET="$(_val PROVISION_SECRET "$(openssl rand -hex 32)")"
log "writing $ENVF"
cat > "$ENVF" <<ENV
PROVISION_SECRET=$PROVISION_SECRET
PROVISION_PORT=$(_val PROVISION_PORT 9098)
STORE_ROOT=$STORE_ROOT
STORE_DOMAIN=$(_val STORE_DOMAIN commerce.nitg-eg.com)
REGISTRY=$(_val REGISTRY ghcr.io/nitgg)
IMAGE_TAG=$(_val IMAGE_TAG latest)
GHCR_USER=$(_val GHCR_USER "")
GHCR_TOKEN=$(_val GHCR_TOKEN "")
PROXY=$PROXY
TLS_MODE=$TLS_MODE
LE_EMAIL=$(_val LE_EMAIL admin@nitg-eg.com)
CALLBACK_URL=$(_val CALLBACK_URL "")
WORKER_SECRET=$(_val WORKER_SECRET "")
PORT_BASE=$(_val PORT_BASE 9100)
API_MEM=$(_val API_MEM 384m)
SITE_MEM=$(_val SITE_MEM 256m)
DASH_MEM=$(_val DASH_MEM 192m)
MAX_CONCURRENT=$(_val MAX_CONCURRENT 2)
SAAS_DB_CONTAINER=$DB_CONTAINER
DB_ROOT_PW=$DB_ROOT_PW
MAIL_HOST=$(_val MAIL_HOST "")
MAIL_PORT=$(_val MAIL_PORT 587)
MAIL_USER=$(_val MAIL_USER "")
MAIL_PASS=$(_val MAIL_PASS "")
MAIL_FROM=$(_val MAIL_FROM "")
CLOUDINARY_CLOUD_NAME=$(_val CLOUDINARY_CLOUD_NAME "")
CLOUDINARY_API_KEY=$(_val CLOUDINARY_API_KEY "")
CLOUDINARY_API_SECRET=$(_val CLOUDINARY_API_SECRET "")
GOOGLE_WEB_CLIENT_ID=$(_val GOOGLE_WEB_CLIENT_ID "")
GOOGLE_CLIENT_SECRET=$(_val GOOGLE_CLIENT_SECRET "")
ACCOUNT_URL=$(_val ACCOUNT_URL "")
MAX_IMAGE_MB=$(_val MAX_IMAGE_MB 5)
TELEGRAM_BOT_TOKEN=$(_val TELEGRAM_BOT_TOKEN "")
TELEGRAM_CHAT_ID=$(_val TELEGRAM_CHAT_ID "")
# Public hostname of this service (for CI rollouts from GitHub Actions). Empty = localhost only.
PROVISION_PUBLIC_HOST=$(_val PROVISION_PUBLIC_HOST "")
ENV
chmod 600 "$ENVF"

# ── 6. Registry login + image pre-pull (so the first creation never pulls) ──
set -a; source "$ENVF"; set +a
if [[ -n "$GHCR_TOKEN" ]]; then
    log "docker login ghcr.io"
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-nitgg}" --password-stdin >/dev/null 2>&1 || echo "!! ghcr login failed"
fi
for app in api site dash; do
    docker pull -q "$REGISTRY/saas-store-$app:$IMAGE_TAG" >/dev/null 2>&1 && log "pulled saas-store-$app:$IMAGE_TAG" \
        || echo "!! could not pull $REGISTRY/saas-store-$app:$IMAGE_TAG (set GHCR_TOKEN / push the images first)"
done

# ── 6b. Public HTTPS vhost for CI (optional; like saas-provision.<academy domain>) ──
# Set PROVISION_PUBLIC_HOST (e.g. saas-store-provision.commerce.nitg-eg.com — the
# wildcard A record already covers it) and GitHub Actions can POST /update-image.
# The shared secret is still required; only the port is exposed through the proxy.
if [[ -n "${PROVISION_PUBLIC_HOST:-}" && "$PROXY" == "nginx" ]]; then
    log "public vhost $PROVISION_PUBLIC_HOST → 127.0.0.1:$PROVISION_PORT"
    cat > "/etc/nginx/conf.d/saas-store-provision.conf" <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name $PROVISION_PUBLIC_HOST;
    client_max_body_size 16m;
    location / {
        proxy_pass http://127.0.0.1:$PROVISION_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
NGX
    nginx -t >/dev/null && systemctl reload nginx
    if [[ "$TLS_MODE" == "per-host" ]]; then
        certbot --nginx -d "$PROVISION_PUBLIC_HOST" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect --keep-until-expiring             && systemctl reload nginx || echo "!! certbot failed for $PROVISION_PUBLIC_HOST — check DNS; vhost is up on http"
    fi
elif [[ -n "${PROVISION_PUBLIC_HOST:-}" ]]; then
    echo "!! PROVISION_PUBLIC_HOST is set but PROXY=$PROXY — add the vhost by hand (proxy → 127.0.0.1:$PROVISION_PORT)"
fi

# ── 7. systemd service ──────────────────────────────────────────────────────
log "installing saas-store-provision.service"
sed -e "s#/var/www/html/saas-stores#$STORE_ROOT#g" "$SRC/saas-store-provision.service" > /etc/systemd/system/saas-store-provision.service
systemctl daemon-reload
systemctl enable saas-store-provision >/dev/null
systemctl restart saas-store-provision
sleep 1
systemctl is-active --quiet saas-store-provision && log "service is active on 127.0.0.1:$PROVISION_PORT" \
    || { echo "!! service failed to start:"; journalctl -u saas-store-provision -n 20 --no-pager; exit 1; }

echo ""
echo "============================================================"
echo "  Store provisioner ready."
echo "  nit2 .env (same box):   STORE_PROVISION_URL=http://127.0.0.1:$PROVISION_PORT"
echo "  nit2 .env (other box):  put it behind a vhost of your web server, like saas-provision.<domain>"
[[ -n "${PROVISION_PUBLIC_HOST:-}" ]] && echo "  GitHub secrets (CI):    STORE_PROVISION_URL=https://$PROVISION_PUBLIC_HOST · STORE_PROVISION_SECRET=<same secret>"
echo "                          STORE_PROVISION_SECRET=$PROVISION_SECRET"
echo "  Then set CALLBACK_URL / WORKER_SECRET / MAIL_* / CLOUDINARY_* in $ENVF"
echo "  and: systemctl restart saas-store-provision"
echo "============================================================"
