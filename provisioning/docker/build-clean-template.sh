#!/usr/bin/env bash
# ============================================================================
#  build-clean-template.sh — build a CLEAN academy template (no EAAC content).
#
#  Spins a throwaway Moodle from the baked image against a scratch DB + data dir,
#  runs a fresh install, applies our defaults (theme_nit, multilang2, front-page
#  layout), then dumps:
#     <SAAS_ROOT>/template.sql          (replaces the EAAC-derived one)
#     <SAAS_ROOT>/moodledata-base/      (clean data dir new academies seed from)
#
#  The OLD template is backed up first. New academies (`create.sh`) import these,
#  so from then on every new academy starts clean.  Run on Server B as root.
#
#  Env (defaults shown):
#     SAAS_ROOT=/var/www/html/saas   NET=saas_net   DB_CONTAINER=saas_mariadb
#     SAAS_IMAGE=ghcr.io/nitgg/saas-moodle:latest
#     ADMIN_USER=admin  ADMIN_PASS=<generated>  ADMIN_EMAIL=admin@nitg-eg.com
#     SITE_FULLNAME="أكاديميتك"  SITE_SHORTNAME="academy"  LANG=ar
# ============================================================================
set -euo pipefail

SAAS_ROOT="${SAAS_ROOT:-/var/www/html/saas}"
NET="${NET:-saas_net}"
DB_CONTAINER="${DB_CONTAINER:-saas_mariadb}"
IMAGE="${SAAS_IMAGE:-ghcr.io/nitgg/saas-moodle:latest}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-Nit#$(openssl rand -hex 4)}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@nitg-eg.com}"
SITE_FULLNAME="${SITE_FULLNAME:-أكاديميتك}"
SITE_SHORTNAME="${SITE_SHORTNAME:-academy}"
SITE_LANG="${LANG_CODE:-ar}"

TMP_DB="moodle_template_build"
TMP_C="saas_template_build"
TMP_DATA="$SAAS_ROOT/.template-build-data"

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

# shellcheck disable=SC1091
source "$SAAS_ROOT/saas.env"   # DB_ROOT_PW
[[ -n "${DB_ROOT_PW:-}" ]] || die "DB_ROOT_PW not found in $SAAS_ROOT/saas.env"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "image $IMAGE not found — pull it first"

cleanup(){ docker rm -f "$TMP_C" >/dev/null 2>&1 || true; rm -rf "$TMP_DATA" 2>/dev/null || true; }
trap cleanup EXIT

# ── 1. Scratch DB + data dir ────────────────────────────────────────────────
log "creating scratch DB $TMP_DB"
docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" <<SQL
DROP DATABASE IF EXISTS \`$TMP_DB\`;
CREATE DATABASE \`$TMP_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'moodle'@'%' IDENTIFIED BY 'moodle';
GRANT ALL PRIVILEGES ON \`$TMP_DB\`.* TO 'moodle'@'%';
FLUSH PRIVILEGES;
SQL
rm -rf "$TMP_DATA"; mkdir -p "$TMP_DATA"; chown -R 33:33 "$TMP_DATA"

# ── 2. config.php for the build container ───────────────────────────────────
cat > "$TMP_DATA/config.php" <<PHP
<?php
unset(\$CFG); global \$CFG; \$CFG = new stdClass();
\$CFG->dbtype='mariadb'; \$CFG->dblibrary='native';
\$CFG->dbhost='$DB_CONTAINER'; \$CFG->dbname='$TMP_DB';
\$CFG->dbuser='moodle'; \$CFG->dbpass='moodle'; \$CFG->prefix='mdl_';
\$CFG->dboptions=array('dbcollation'=>'utf8mb4_unicode_ci');
\$CFG->wwwroot='http://localhost'; \$CFG->dataroot='/var/www/moodledata';
\$CFG->admin='admin'; \$CFG->directorypermissions=0777;
require_once(__DIR__ . '/lib/setup.php');
PHP

# ── 3. Boot a throwaway container (config + data mounted) ────────────────────
log "starting build container"
docker run -d --name "$TMP_C" --network "$NET" \
    -v "$TMP_DATA/config.php":/var/www/html/config.php:ro \
    -v "$TMP_DATA":/var/www/moodledata \
    "$IMAGE" >/dev/null
sleep 4

# ── 4. Fresh install into the scratch DB ────────────────────────────────────
log "installing a clean Moodle (fullname='$SITE_FULLNAME' lang=$SITE_LANG)"
docker exec "$TMP_C" php /var/www/html/admin/cli/install_database.php \
    --agree-license --lang="$SITE_LANG" \
    --adminuser="$ADMIN_USER" --adminpass="$ADMIN_PASS" --adminemail="$ADMIN_EMAIL" \
    --fullname="$SITE_FULLNAME" --shortname="$SITE_SHORTNAME" \
    || die "install_database.php failed"

# ── 5. Our defaults (theme + multilang + Arabic pack) ───────────────────────
log "applying defaults: theme_nit, multilang2 filter"
docker exec "$TMP_C" php /var/www/html/admin/cli/cfg.php --name=theme --set=nit || true
# Public marketing front page: guests can see it (no forced login) and everyone
# lands on the Site home (front page with the seeded sections), not /my/.
docker exec "$TMP_C" php /var/www/html/admin/cli/cfg.php --name=forcelogin --set=0 || true
docker exec "$TMP_C" php /var/www/html/admin/cli/cfg.php --name=defaulthomepage --set=0 || true
docker exec "$TMP_C" php /var/www/html/admin/cli/install_langpack.php --lang=ar || true
cat > "$TMP_DATA/enable_mlang.php" <<'PHP'
<?php
define('CLI_SCRIPT', true); require('/var/www/html/config.php');
require_once($CFG->libdir.'/filterlib.php');
filter_set_global_state('multilang2', TEXTFILTER_ON);
$sf = array_filter(array_map('trim', explode(',', (string)get_config('core','stringfilters'))));
if (!in_array('multilang2',$sf,true)) $sf[] = 'multilang2';
set_config('stringfilters', implode(',', $sf)); set_config('filterall', 1);
echo "multilang2 on\n";
PHP
docker exec "$TMP_C" php /var/www/moodledata/enable_mlang.php || true

# ── 6. (Home page) hook — seed default front-page sections if a seeder exists ─
# Drop a seed_homepage.php next to this script to auto-add the placeholder
# nit_section blocks (hero/about/courses/gallery/contact). See build notes.
SEED_DIR="$(dirname "$0")"
if [[ -f "$SEED_DIR/seed_homepage.php" && -d "$SEED_DIR/home-sections" ]]; then
    log "seeding home page from home-sections/"
    docker exec "$TMP_C" rm -rf /var/www/moodledata/home-sections
    docker cp "$SEED_DIR/home-sections" "$TMP_C:/var/www/moodledata/home-sections"
    docker cp "$SEED_DIR/seed_homepage.php" "$TMP_C:/var/www/moodledata/seed_homepage.php"
    docker exec "$TMP_C" php /var/www/moodledata/seed_homepage.php || echo "!! home-page seed failed"
    docker exec "$TMP_C" rm -rf /var/www/moodledata/seed_homepage.php /var/www/moodledata/home-sections || true
else
    log "no home-sections/ — skipping home-page seed (front page will be empty)"
fi

docker exec "$TMP_C" php /var/www/html/admin/cli/purge_caches.php || true

# ── 7. Dump the new clean template ──────────────────────────────────────────
STAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -f "$SAAS_ROOT/template.sql" ]]; then
    log "backing up old template.sql -> template.sql.eaac-$STAMP"
    cp -a "$SAAS_ROOT/template.sql" "$SAAS_ROOT/template.sql.eaac-$STAMP"
fi
if [[ -d "$SAAS_ROOT/moodledata-base" ]]; then
    log "backing up old moodledata-base -> moodledata-base.eaac-$STAMP"
    mv "$SAAS_ROOT/moodledata-base" "$SAAS_ROOT/moodledata-base.eaac-$STAMP"
fi

log "dumping clean template.sql"
docker exec "$DB_CONTAINER" mariadb-dump -uroot -p"$DB_ROOT_PW" \
    --single-transaction --no-tablespaces "$TMP_DB" > "$SAAS_ROOT/template.sql"

log "copying clean moodledata-base (minus config + build helpers)"
mkdir -p "$SAAS_ROOT/moodledata-base"
# Copy the built data dir but drop the build-only config.php / helper scripts.
rsync -a \
    --exclude=config.php --exclude=enable_mlang.php --exclude=seed_homepage.php \
    --exclude=localcache --exclude=sessions --exclude=temp --exclude=trashdir \
    --exclude=cache --exclude=muc --exclude=lock \
    "$TMP_DATA/." "$SAAS_ROOT/moodledata-base/" 2>/dev/null \
    || cp -a "$TMP_DATA/." "$SAAS_ROOT/moodledata-base/"
rm -f "$SAAS_ROOT/moodledata-base/config.php" "$SAAS_ROOT/moodledata-base/enable_mlang.php"
chown -R 33:33 "$SAAS_ROOT/moodledata-base"

# ── 8. Drop the scratch DB ──────────────────────────────────────────────────
docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" -e "DROP DATABASE IF EXISTS \`$TMP_DB\`;"

echo ""
echo "============================================================"
echo "  Clean template built."
echo "    $SAAS_ROOT/template.sql        (was backed up to *.eaac-$STAMP)"
echo "    $SAAS_ROOT/moodledata-base/"
echo "  Template admin login (baked into template.sql, shared by new academies):"
echo "    username: $ADMIN_USER"
echo "    password: $ADMIN_PASS"
echo "  New academies now start clean. Test:"
echo "    SAAS_IMAGE=$IMAGE bash /root/create.sh cleantest \"Clean Test\""
echo "============================================================"
