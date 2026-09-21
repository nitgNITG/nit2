#!/usr/bin/env bash
# ============================================================================
#  create-store.sh — provision ONE merchant store as a compose project.
#
#  Result: clients/<slug>/{store.env,compose.yml}, a schema + scoped user in
#  the shared MariaDB, three containers (api/site/dash) under project
#  store_<slug>, the host vhost <slug>.<STORE_DOMAIN> (+ certbot) and the store
#  bootstrapped through the api's own CLI (settings, owner, licence, welcome
#  e-mail). Target: ≤ 30 s to live, ≤ 60 s with per-host certbot.
#
#  Usage:   bash create-store.sh <slug> "<name>"
#  Env (from provision-server.py; see provision.env for the platform values):
#    BOOTSTRAP_JSON   the store-api `cli setup` document (name, owner, licence, …)
#    IMAGE_TAG        image version for this store (default: provision.env IMAGE_TAG)
#    LOGO_PATH        staged logo file to upload to Cloudinary (optional)
#    STORE_JOB        job id — enables progress reporting to nit2
#
#  Every step reports progress; any failure reports `failed` with the step name
#  and leaves the partial store for destroy-store.sh to clean up.
# ============================================================================
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
trap 'on_error' ERR

SLUG_IN="${1:-}"; NAME="${2:-}"
[[ -n "$SLUG_IN" && -n "$NAME" ]] || die "Usage: bash create-store.sh <slug> \"<name>\""
store_paths "$SLUG_IN"
[[ -n "${BOOTSTRAP_JSON:-}" ]] || die "BOOTSTRAP_JSON is required"

TOTAL=11
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-ghcr.io/nitgg}"
DB_CONTAINER="${SAAS_DB_CONTAINER:-saas_mariadb}"
TLS_MODE="${TLS_MODE:-per-host}"
SCHEME="https"; [[ "$TLS_MODE" == "none" ]] && SCHEME="http"
PUBLIC_URL="${SCHEME}://${HOST}"

# ── 1. Guards ────────────────────────────────────────────────────────────────
report_step 1 $TOTAL "Checking that '$SLUG' is free"
if [[ -d "$CLIENT_DIR" && "${FORCE_RECREATE:-0}" == "1" ]]; then
    log "FORCE_RECREATE: removing the previous attempt first"
    STORE_JOB= bash "$SCRIPTS_DIR/destroy-store.sh" "$SLUG" || die "could not clean the previous attempt"
fi
[[ ! -d "$CLIENT_DIR" ]] || die "$CLIENT_DIR already exists (run destroy-store.sh $SLUG first)"
docker compose ls --format json 2>/dev/null | grep -q "\"$PROJECT\"" && die "compose project $PROJECT already exists"
docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" || die "shared MariaDB container $DB_CONTAINER is not running (run setup.sh)"
[[ -n "${DB_ROOT_PW:-}" ]] || die "DB_ROOT_PW is not set in provision.env"
docker network inspect saas_net >/dev/null 2>&1 || docker network create saas_net >/dev/null

# ── 2. Images present? (setup.sh / bump-image.sh pre-pull; this is the slow path) ──
report_step 2 $TOTAL "Checking images $IMAGE_TAG"
for app in api site dash; do
    img="$REGISTRY/saas-store-$app:$IMAGE_TAG"
    docker image inspect "$img" >/dev/null 2>&1 || { log "pulling $img"; docker pull -q "$img" >/dev/null; }
done

# ── 3. Ports ─────────────────────────────────────────────────────────────────
report_step 3 $TOTAL "Allocating ports"
alloc_ports
log "ports: site=$P_SITE dash=$P_DASH api=$P_API"

# ── 4. Database (schema + user scoped to it, random password) ───────────────
report_step 4 $TOTAL "Creating database $DB_NAME"
DB_PASS="$(openssl rand -hex 24)"
docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'%' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'%';
FLUSH PRIVILEGES;
SQL

# ── 5. store.env + compose.yml ───────────────────────────────────────────────
report_step 5 $TOTAL "Writing store configuration"
mkdir -p "$CLIENT_DIR"
chmod 700 "$CLIENT_DIR"
cp "$SCRIPTS_DIR/compose.store.yml" "$COMPOSE_FILE"
cat > "$ENV_FILE" <<ENV
# store: $SLUG — generated $(date -u +%FT%TZ) by create-store.sh. Secrets inside; keep 0600.
IMAGE_TAG=$IMAGE_TAG
REGISTRY=$REGISTRY
P_SITE=$P_SITE
P_DASH=$P_DASH
P_API=$P_API
API_MEM=${API_MEM:-384m}
SITE_MEM=${SITE_MEM:-256m}
DASH_MEM=${DASH_MEM:-192m}

STORE_SLUG=$SLUG
PUBLIC_URL=$PUBLIC_URL
API_PREFIX=/apis/v1
API_PUBLIC_URL=$PUBLIC_URL
DASHBOARD_URL=$PUBLIC_URL/dashboard
ALLOWED_ORIGINS=$PUBLIC_URL
PROD=true

DATABASE_HOST=$DB_CONTAINER
DATABASE_PORT=3306
DATABASE_USER=$DB_USER
DATABASE_PASSWORD=$DB_PASS
DATABASE_NAME=$DB_NAME
DATABASE_URL=mysql://$DB_USER:$DB_PASS@$DB_CONTAINER:3306/$DB_NAME

JWT_SECRET=$(openssl rand -hex 32)
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
REVALIDATE_SECRET=$(openssl rand -hex 24)

ACCOUNT_URL=${ACCOUNT_URL:-}
GOOGLE_WEB_CLIENT_ID=${GOOGLE_WEB_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}
CLOUDINARY_ROOT_FOLDER=stores/$SLUG
MAIL_HOST=${MAIL_HOST:-}
MAIL_PORT=${MAIL_PORT:-587}
MAIL_USER=${MAIL_USER:-}
MAIL_PASS=${MAIL_PASS:-}
MAIL_FROM=${MAIL_FROM:-}
ENV
chmod 600 "$ENV_FILE"

# ── 6. Containers (api runs migrate deploy, then site + dash) ───────────────
report_step 6 $TOTAL "Starting containers"
compose up -d --quiet-pull 2>&1 | grep -v "^$" || true
if ! wait_api_health "$P_API" 90; then
    compose logs --tail 40 api || true
    die "api did not become healthy within 90s"
fi

# ── 7. Logo → Cloudinary (optional, best effort) ────────────────────────────
LOGO_URL=""
if [[ -n "${LOGO_PATH:-}" && -f "$LOGO_PATH" && -n "${CLOUDINARY_CLOUD_NAME:-}" && -n "${CLOUDINARY_API_KEY:-}" && -n "${CLOUDINARY_API_SECRET:-}" ]]; then
    report_step 7 $TOTAL "Uploading logo"
    LOGO_URL="$(bash "$SCRIPTS_DIR/upload-image.sh" "$LOGO_PATH" "stores/$SLUG/brand" "logo" || true)"
    [[ -n "$LOGO_URL" ]] && log "logo: $LOGO_URL" || warn "logo upload failed (continuing without)"
else
    report_step 7 $TOTAL "No logo to upload"
fi

# ── 8. Bootstrap through the api CLI (settings + owner + licence + e-mail) ──
report_step 8 $TOTAL "Bootstrapping store (settings, owner, licence)"
BOOT="$BOOTSTRAP_JSON"
if [[ -n "$LOGO_URL" ]]; then
    BOOT="$(J="$BOOT" U="$LOGO_URL" "${PYTHON_BIN:-python3}" -c 'import json,os; d=json.loads(os.environ["J"]); d["logo_url"]=os.environ["U"]; print(json.dumps(d, ensure_ascii=False))')"
fi
SETUP_OUT="$(store_cli setup --file - <<<"$BOOT")" || { echo "$SETUP_OUT"; die "cli setup failed"; }
[[ "$(json_get "$SETUP_OUT" ok)" == "True" ]] || die "cli setup: $(json_get "$SETUP_OUT" error)"
OWNER_EMAIL="$(json_get "$SETUP_OUT" owner.email)"
GENERATED_PW="$(json_get "$SETUP_OUT" password)"
MAIL_SENT="$(json_get "$SETUP_OUT" mail.sent)"
log "owner=$OWNER_EMAIL mail_sent=$MAIL_SENT"

# ── 9. Host proxy (+ TLS) ───────────────────────────────────────────────────
report_step 9 $TOTAL "Publishing $HOST"
bash "$SCRIPTS_DIR/proxy/proxy.sh" add "$SLUG" "$HOST" "$P_SITE" "$P_DASH" "$P_API"

# ── 10. Smoke test through the proxy (no DNS dependency: --resolve) ─────────
report_step 10 $TOTAL "Smoke test"
smoke(){ # $1=path $2=direct host port (used when PROXY=none)
    if [[ "${PROXY:-nginx}" == "none" ]]; then
        curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:$2$1"
        return
    fi
    local port=443 proto=https
    [[ "$SCHEME" == "http" ]] && { port=80; proto=http; }
    curl -sk -o /dev/null -w '%{http_code}' --resolve "$HOST:$port:127.0.0.1" -m 15 "$proto://$HOST$1"
}
for pair in "/apis/v1/health:$P_API" "/dashboard/login:$P_DASH" "/:$P_SITE"; do
    p="${pair%%:*}"; port="${pair##*:}"
    code="$(smoke "$p" "$port" || echo 000)"
    [[ "$code" =~ ^(200|307|308)$ ]] || die "smoke test $p → HTTP $code"
    log "smoke $p → $code"
done

# ── 11. Done ────────────────────────────────────────────────────────────────
report_step 11 $TOTAL "Live"
EXTRA="\"image_tag\":$(json_escape "$IMAGE_TAG"),\"owner_email\":$(json_escape "$OWNER_EMAIL"),\"mail_sent\":$([[ "$MAIL_SENT" == "True" ]] && echo true || echo false)"
# Only when nit2 did not supply the owner password (then it must store this one).
[[ -n "$GENERATED_PW" && "$GENERATED_PW" != "None" ]] && EXTRA="$EXTRA,\"owner_password\":$(json_escape "$GENERATED_PW")"
report_done "$PUBLIC_URL" "$EXTRA"

echo ""
echo "============================================================"
echo "  '$NAME' is live:  $PUBLIC_URL"
echo "  project=$PROJECT  ports=$P_SITE/$P_DASH/$P_API  db=$DB_NAME  tag=$IMAGE_TAG"
echo "============================================================"
