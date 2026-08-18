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
#  Env (optional):  GITHUB_TOKEN  — token to clone a PRIVATE saas repo.
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
