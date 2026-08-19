#!/usr/bin/env bash
# ============================================================================
#  create.sh — provision ONE client academy on server B (3alemny / Apache).
#
#  Does exactly what the brief asks, for Apache:
#    1) create virtual host   2) clone the academy branch   3) enable vhost
#    4) add SSL (certbot)      5) restart apache
#  ...plus the container + database each client needs.
#
#  Usage:   sudo bash create.sh <slug> "<Academy name>"
#  Result:  https://<slug>.academy2026.nitg-eg.com   (own DB, moodledata, HTTPS)
#
#  First run auto-bootstraps shared infra (network + shared MariaDB + template
#  taken from the existing EAAC). Every run just provisions the given client.
#
#  Env (optional):
#    GITHUB_TOKEN        — token to clone a PRIVATE saas repo.
#    Branding (applied after the site is up, via theme/nit/cli/apply_brand.php):
#      BRAND_FULLNAME_AR / BRAND_FULLNAME_EN    site full name per language
#      BRAND_SHORTNAME_AR / BRAND_SHORTNAME_EN  site short name per language
#      BRAND_LOGO         — host path to a logo image file
#      BRAND_FAVICON      — host path to a favicon file
#    When no BRAND_FULLNAME_* is given, the <name> arg becomes the full name,
#    so a manual run still sets the site name (instead of the template's).
# ============================================================================
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
DOMAIN="academy2026.nitg-eg.com"          # client = <slug>.academy2026.nitg-eg.com
REPO_OWNER="NITGg"
REPO_NAME="saas-demo"
ROOT="/opt/saas"
NET="saas_net"
DB_CONTAINER="saas_mariadb"               # our own shared DB (EAAC's is untouched)
IMAGE="moodle-new:latest"                 # reuse the existing EAAC image
PORT_BASE=8100
LE_EMAIL="admin@nitg-eg.com"

# Source for the one-time template (the existing EAAC on this server):
SRC_DB_CONTAINER="moodle_db_new"
SRC_DB_NAME="moodle"
SRC_DB_USER="moodle"
SRC_DB_PASS='moodlePass#2026'
SRC_MOODLEDATA="/var/www/html/moodle-new-version/moodledata"
# ────────────────────────────────────────────────────────────────────────────

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"; NAME="${2:-}"
[[ -n "$SLUG" && -n "$NAME" ]] || die "Usage: sudo bash create.sh <slug> \"<name>\""
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "Invalid slug (lowercase letters/digits/hyphens, 3-40)."

DB_NAME="moodle_${SLUG//-/_}"
CONTAINER="saas_moodle_${SLUG}"
SUBDOMAIN="${SLUG}.${DOMAIN}"
CODE_DIR="$ROOT/clients/$SLUG/code"
DATA_DIR="$ROOT/clients/$SLUG/moodledata"
BRANCH="client/$SLUG"
VHOST="/etc/apache2/sites-available/${SUBDOMAIN}.conf"

# ── One-time shared infrastructure ──────────────────────────────────────────
ensure_infra(){
    mkdir -p "$ROOT/clients"

    if [[ ! -f "$ROOT/saas.env" ]]; then
        { echo "DB_ROOT_PW=$(openssl rand -hex 24)"; } > "$ROOT/saas.env"
        chmod 600 "$ROOT/saas.env"
    fi
    # shellcheck disable=SC1091
    source "$ROOT/saas.env"

    docker network inspect "$NET" >/dev/null 2>&1 || { docker network create "$NET"; log "created network $NET"; }

    if ! docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
        log "starting shared MariaDB ($DB_CONTAINER)"
        docker run -d --name "$DB_CONTAINER" --network "$NET" --restart unless-stopped \
            -e MYSQL_ROOT_PASSWORD="$DB_ROOT_PW" \
            -v saas_db_data:/var/lib/mysql \
            mariadb:11.4
        log "waiting for shared MariaDB"
        for _ in $(seq 1 30); do
            docker exec "$DB_CONTAINER" mariadb-admin ping -uroot -p"$DB_ROOT_PW" --silent >/dev/null 2>&1 && break
            sleep 2
        done
    fi

    if [[ ! -f "$ROOT/template.sql" ]]; then
        log "creating template.sql from the existing EAAC database (one time)"
        docker exec "$SRC_DB_CONTAINER" mariadb-dump -u"$SRC_DB_USER" -p"$SRC_DB_PASS" \
            --single-transaction --no-tablespaces "$SRC_DB_NAME" > "$ROOT/template.sql"
    fi
    if [[ ! -d "$ROOT/moodledata-base" ]]; then
        log "creating moodledata-base from the existing EAAC (one time)"
        mkdir -p "$ROOT/moodledata-base"
        cp -a "$SRC_MOODLEDATA/." "$ROOT/moodledata-base/" 2>/dev/null || true
    fi

    # Apache modules the vhost needs (idempotent)
    a2enmod proxy proxy_http headers rewrite ssl >/dev/null 2>&1 || true
}

find_free_port(){
    local p="$PORT_BASE"
    while ss -tlnH "( sport = :$p )" 2>/dev/null | grep -q .; do p=$((p+1)); done
    echo "$p"
}

# ── Guard ───────────────────────────────────────────────────────────────────
docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER" && die "client '$SLUG' already exists."

ensure_infra
# shellcheck disable=SC1091
source "$ROOT/saas.env"
PORT="$(find_free_port)"
log "client=$SLUG  subdomain=$SUBDOMAIN  port=$PORT  db=$DB_NAME"

# ── 1. Clone the client branch ──────────────────────────────────────────────
log "cloning $BRANCH"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    CLONE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"
else
    CLONE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
fi
rm -rf "$CODE_DIR"; mkdir -p "$(dirname "$CODE_DIR")"
git clone --depth 1 --branch "$BRANCH" "$CLONE_URL" "$CODE_DIR"

# ── 2. Seed moodledata ──────────────────────────────────────────────────────
log "seeding moodledata"
mkdir -p "$DATA_DIR"
cp -a "$ROOT/moodledata-base/." "$DATA_DIR/" 2>/dev/null || true
chown -R 33:33 "$DATA_DIR"

# ── 3. Create DB + import template ──────────────────────────────────────────
log "creating database $DB_NAME"
docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'moodle'@'%' IDENTIFIED BY 'moodle';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO 'moodle'@'%';
FLUSH PRIVILEGES;
SQL
log "importing template"
docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" "$DB_NAME" < "$ROOT/template.sql"

# ── 4. Write config.php ─────────────────────────────────────────────────────
log "writing config.php"
cat > "$CODE_DIR/config.php" <<PHP
<?php
unset(\$CFG); global \$CFG; \$CFG = new stdClass();
\$CFG->dbtype    = 'mariadb';
\$CFG->dblibrary = 'native';
\$CFG->dbhost    = '$DB_CONTAINER';
\$CFG->dbname    = '$DB_NAME';
\$CFG->dbuser    = 'moodle';
\$CFG->dbpass    = 'moodle';
\$CFG->prefix    = 'mdl_';
\$CFG->dboptions = array('dbpersist'=>0,'dbport'=>'','dbsocket'=>'','dbcollation'=>'utf8mb4_unicode_ci');
\$CFG->wwwroot   = 'https://$SUBDOMAIN';
\$CFG->dataroot  = '/var/www/moodledata';
\$CFG->admin     = 'admin';
\$CFG->directorypermissions = 0777;
\$CFG->sslproxy  = true;
require_once(__DIR__ . '/lib/setup.php');
PHP

# ── 5. Start the container ──────────────────────────────────────────────────
log "starting container $CONTAINER on 127.0.0.1:$PORT"
docker run -d --name "$CONTAINER" --network "$NET" --restart unless-stopped \
    -v "$CODE_DIR":/var/www/html \
    -v "$DATA_DIR":/var/www/moodledata \
    -p "127.0.0.1:$PORT:80" \
    "$IMAGE"

log "finalising Moodle (upgrade + purge caches)"
sleep 5
docker exec "$CONTAINER" php /var/www/html/admin/cli/upgrade.php --non-interactive || true

# Enable the {mlang} multi-language filter (plugin ships in the base code) so
# {mlang ..} tags render instead of showing raw — no manual install by the client.
log "enabling multilang2 filter"
cat > "$CODE_DIR/enable_mlang.php" <<'PHP'
<?php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir.'/filterlib.php');
filter_set_global_state('multilang2', TEXTFILTER_ON);
$sf = get_config('core', 'stringfilters');
$list = array_filter(array_map('trim', explode(',', (string)$sf)));
if (!in_array('multilang2', $list, true)) { $list[] = 'multilang2'; }
set_config('stringfilters', implode(',', $list));  // apply to headings/titles too
set_config('filterall', 1);
echo "multilang2 enabled\n";
PHP
docker exec "$CONTAINER" php /var/www/html/enable_mlang.php || true
rm -f "$CODE_DIR/enable_mlang.php"

# Apply per-client branding: site name (full + short, AR/EN) + logo + favicon.
# The NIT "build your product" form collects these; the provisioning service
# stages the images and passes them as env, so the client never opens Moodle's
# admin settings. A manual run with no BRAND_* env still names the site (<name>).
log "applying branding"
BRAND_DIR="$CODE_DIR/nit-brand"
rm -rf "$BRAND_DIR"; mkdir -p "$BRAND_DIR"

LOGO_REL=""; FAVICON_REL=""
if [[ -n "${BRAND_LOGO:-}" && -f "${BRAND_LOGO}" ]]; then
    ext="${BRAND_LOGO##*.}"; cp -f "$BRAND_LOGO" "$BRAND_DIR/logo.${ext}"; LOGO_REL="logo.${ext}"
fi
if [[ -n "${BRAND_FAVICON:-}" && -f "${BRAND_FAVICON}" ]]; then
    ext="${BRAND_FAVICON##*.}"; cp -f "$BRAND_FAVICON" "$BRAND_DIR/favicon.${ext}"; FAVICON_REL="favicon.${ext}"
fi

# Full name: explicit env wins; otherwise fall back to the <name> arg so the
# site is never left showing the template's name.
B_FN_AR="${BRAND_FULLNAME_AR:-}"; B_FN_EN="${BRAND_FULLNAME_EN:-}"
if [[ -z "$B_FN_AR" && -z "$B_FN_EN" ]]; then B_FN_EN="$NAME"; fi

# Build the manifest with python (values via env, so Arabic/spaces are safe).
BRAND_FULLNAME_AR="$B_FN_AR" BRAND_FULLNAME_EN="$B_FN_EN" \
BRAND_SHORTNAME_AR="${BRAND_SHORTNAME_AR:-}" BRAND_SHORTNAME_EN="${BRAND_SHORTNAME_EN:-}" \
LOGO_REL="$LOGO_REL" FAVICON_REL="$FAVICON_REL" \
python3 - "$BRAND_DIR/brand.json" <<'PYJSON'
import json, os, sys
d = {
    "fullname_ar":  os.environ.get("BRAND_FULLNAME_AR", ""),
    "fullname_en":  os.environ.get("BRAND_FULLNAME_EN", ""),
    "shortname_ar": os.environ.get("BRAND_SHORTNAME_AR", ""),
    "shortname_en": os.environ.get("BRAND_SHORTNAME_EN", ""),
}
if os.environ.get("LOGO_REL"):    d["logo"]    = os.environ["LOGO_REL"]
if os.environ.get("FAVICON_REL"): d["favicon"] = os.environ["FAVICON_REL"]
json.dump(d, open(sys.argv[1], "w"), ensure_ascii=False)
PYJSON

docker exec "$CONTAINER" php /var/www/html/public/theme/nit/cli/apply_brand.php \
    --manifest=/var/www/html/nit-brand/brand.json || echo "!! branding step failed (site still live)"
rm -rf "$BRAND_DIR"

# ── Licence tier (local_license) — from the plan the client picked ───────────
# LICENSE_TIER comes from the provisioner (demo|basic|standard|professional).
# Setting `enabled=1` turns enforcement ON so the tier's caps/features apply.
TIER="${LICENSE_TIER:-demo}"
case "$TIER" in demo|basic|standard|professional) ;; *) TIER="demo" ;; esac
log "setting local_license tier=$TIER (enforcement on)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=tier    --set="$TIER" || echo "!! could not set licence tier (site still live)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=enabled --set=1       || echo "!! could not enable licence enforcement"

# ── Global platform settings (local_multitopics) — pushed from nit2 ──────────
# These MUST be identical for every academy (google_client_id, store URLs, …).
# Passed in as SETTING_<KEY> env by the provisioner; only non-empty ones apply.
for _skey in google_client_id apple_client_id facebook_app_id android_version android_url ios_version ios_url; do
    _senv="SETTING_$(echo "$_skey" | tr '[:lower:]' '[:upper:]')"
    _sval="${!_senv:-}"
    if [[ -n "$_sval" ]]; then
        log "setting local_multitopics/$_skey"
        docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_multitopics --name="$_skey" --set="$_sval" || echo "!! could not set $_skey"
    fi
done

docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true

# ── 6. Apache vhost → enable → SSL → restart ────────────────────────────────
log "creating apache vhost"
cat > "$VHOST" <<APACHE
<VirtualHost *:80>
    ServerName $SUBDOMAIN
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:$PORT/
    ProxyPassReverse / http://127.0.0.1:$PORT/
    RequestHeader set X-Forwarded-Proto "https"
    ErrorLog \${APACHE_LOG_DIR}/${SLUG}_error.log
    CustomLog \${APACHE_LOG_DIR}/${SLUG}_access.log combined
</VirtualHost>
APACHE

a2ensite "${SUBDOMAIN}.conf" >/dev/null
apache2ctl configtest && systemctl reload apache2

log "requesting HTTPS certificate (certbot)"
certbot --apache -d "$SUBDOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect \
    || echo "!! certbot failed — verify $SUBDOMAIN resolves here (wildcard DNS) and port 80 is open."

systemctl reload apache2

echo ""
echo "============================================================"
echo "  '$NAME' is live:  https://$SUBDOMAIN"
echo "  container=$CONTAINER  port=$PORT  db=$DB_NAME"
echo "============================================================"
