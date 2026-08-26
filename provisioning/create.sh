#!/usr/bin/env bash
# ============================================================================
#  create.sh — provision ONE client academy from the BAKED IMAGE (server B / Apache).
#
#  The Moodle code is NOT cloned per client and NOT
#  bind-mounted. It is baked into the image (see docker/build-image.sh). Each
#  client keeps ONLY a per-client config.php + moodledata + database. Result:
#  ~700 MB/client -> ~120 MB/client, no .git on the server.
#
#  Usage:   SAAS_IMAGE=saas-moodle:2026.08 sudo -E bash create.sh <slug> "<name>"
#
#  Env:
#    SAAS_IMAGE     baked image to run (default: saas-moodle:latest)
#    CUSTOM_CODE=1  this client needs its own code -> fall back to clone+bind-mount
#                   (the old behaviour, isolated to this one client)
#    GITHUB_TOKEN, BRAND_*, LICENSE_*, SETTING_*  — same contract as create.sh
# ============================================================================
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
DOMAIN="academy2026.nitg-eg.com"
REPO_OWNER="NITGg"
REPO_NAME="saas-demo"
ROOT="${SAAS_ROOT:-/var/www/html/saas}"   # academies data dir (override with SAAS_ROOT)
NET="saas_net"
DB_CONTAINER="saas_mariadb"
IMAGE="${SAAS_IMAGE:-saas-moodle:latest}"   # ← baked image, not moodle-new:latest
PORT_BASE=8100
LE_EMAIL="admin@nitg-eg.com"

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
CLIENT_DIR="$ROOT/clients/$SLUG"
CODE_DIR="$CLIENT_DIR/code"                 # only used for CUSTOM_CODE clients
DATA_DIR="$CLIENT_DIR/moodledata"
CONF="$CLIENT_DIR/config.php"               # per-client config, mounted read-only
BRANCH="client/$SLUG"
VHOST="/etc/apache2/sites-available/${SUBDOMAIN}.conf"

# ── One-time shared infrastructure (identical to create.sh) ─────────────────
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

    a2enmod proxy proxy_http headers rewrite ssl >/dev/null 2>&1 || true
}

find_free_port(){
    local p="$PORT_BASE"
    while ss -tlnH "( sport = :$p )" 2>/dev/null | grep -q .; do p=$((p+1)); done
    echo "$p"
}

# ── Guards ──────────────────────────────────────────────────────────────────
docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER" && die "client '$SLUG' already exists."
docker image inspect "$IMAGE" >/dev/null 2>&1 \
    || die "image '$IMAGE' not found — build it first: bash docker/build-image.sh"

ensure_infra
# shellcheck disable=SC1091
source "$ROOT/saas.env"
PORT="$(find_free_port)"
log "client=$SLUG  subdomain=$SUBDOMAIN  port=$PORT  db=$DB_NAME  image=$IMAGE"

mkdir -p "$CLIENT_DIR"

# ── 1. Code — baked (default) or cloned (CUSTOM_CODE) ───────────────────────
if [[ "${CUSTOM_CODE:-0}" == "1" ]]; then
    log "CUSTOM_CODE=1 — cloning $BRANCH for a per-client code copy"
    if [[ -n "${GITHUB_TOKEN:-}" ]]; then
        CLONE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"
    else
        CLONE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
    fi
    rm -rf "$CODE_DIR"
    git clone --depth 1 --branch "$BRANCH" "$CLONE_URL" "$CODE_DIR"
else
    log "using baked image code (no per-client clone)"
    rm -rf "$CODE_DIR"   # ensure no stale copy lingers
fi

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

# ── 4. Write config.php (per-client file, mounted over the baked path) ───────
log "writing config.php -> $CONF"
CONFIG_TARGET="$CONF"
[[ "${CUSTOM_CODE:-0}" == "1" ]] && CONFIG_TARGET="$CODE_DIR/config.php"
cat > "$CONFIG_TARGET" <<PHP
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
// Public marketing front page: guests can view it, and everyone lands on the
// Site home (the seeded sections), never the /my/ dashboard. Forced here so it
// can't be lost to a stale DB/cache value.
\$CFG->defaulthomepage = 0;   // HOMEPAGE_SITE
\$CFG->forcelogin      = 0;
\$CFG->enablemyhome    = 1;   // REQUIRED: makes Site home a valid landing page —
                             // without it, defaulthomepage=SITE still falls back
                             // to the /my dashboard (see get_home_page()).
PHP

# ── Outbound email (SMTP relay) — values from provision.env; secrets NEVER in git.
# Lets every academy send the welcome email (and all mail) through the shared relay.
if [[ -n "${SMTP_HOSTS:-}" ]]; then
    {
        echo "\$CFG->smtphosts    = '${SMTP_HOSTS}';"
        echo "\$CFG->smtpsecure   = '${SMTP_SECURE:-tls}';"
        echo "\$CFG->smtpauthtype = '${SMTP_AUTHTYPE:-LOGIN}';"
        echo "\$CFG->smtpuser     = '${SMTP_USER:-}';"
        echo "\$CFG->smtppass     = '${SMTP_PASS:-}';"
        echo "\$CFG->smtpmaxbulk  = ${SMTP_MAXBULK:-10};"
        echo "\$CFG->noreplyaddress = '${SMTP_NOREPLY:-${SMTP_USER:-no-reply@$DOMAIN}}';"
        [[ -n "${SMTP_SUPPORTEMAIL:-}" ]] && echo "\$CFG->supportemail = '${SMTP_SUPPORTEMAIL}';"
    } >> "$CONFIG_TARGET"
fi

echo "require_once(__DIR__ . '/lib/setup.php');" >> "$CONFIG_TARGET"

# ── 5. Start the container ──────────────────────────────────────────────────
# Pull the baked image first so a NEW academy also gets the freshest build when
# SAAS_IMAGE is a moving tag (…:latest). Immutable version tags = fast no-op.
if [[ "${CUSTOM_CODE:-0}" != "1" ]]; then
    log "pulling $IMAGE"
    docker pull "$IMAGE" >/dev/null 2>&1 || true
fi
log "starting container $CONTAINER on 127.0.0.1:$PORT"
if [[ "${CUSTOM_CODE:-0}" == "1" ]]; then
    docker run -d --name "$CONTAINER" --network "$NET" --restart unless-stopped \
        -v "$CODE_DIR":/var/www/html \
        -v "$DATA_DIR":/var/www/moodledata \
        -p "127.0.0.1:$PORT:80" \
        "$IMAGE"
else
    docker run -d --name "$CONTAINER" --network "$NET" --restart unless-stopped \
        -v "$CONF":/var/www/html/config.php:ro \
        -v "$DATA_DIR":/var/www/moodledata \
        -p "127.0.0.1:$PORT:80" \
        "$IMAGE"
fi

log "finalising Moodle (upgrade + purge caches)"
sleep 5
docker exec "$CONTAINER" php /var/www/html/admin/cli/upgrade.php --non-interactive || true

# ── Enable the multilang2 filter (baked code ships it) ──────────────────────
log "enabling multilang2 filter"
TMP_MLANG="$(mktemp)"
cat > "$TMP_MLANG" <<'PHP'
<?php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir.'/filterlib.php');
filter_set_global_state('multilang2', TEXTFILTER_ON);
$sf = get_config('core', 'stringfilters');
$list = array_filter(array_map('trim', explode(',', (string)$sf)));
if (!in_array('multilang2', $list, true)) { $list[] = 'multilang2'; }
set_config('stringfilters', implode(',', $list));
set_config('filterall', 1);
echo "multilang2 enabled\n";
PHP
docker cp "$TMP_MLANG" "$CONTAINER:/tmp/enable_mlang.php"
docker exec "$CONTAINER" php /tmp/enable_mlang.php || true
docker exec "$CONTAINER" rm -f /tmp/enable_mlang.php || true
rm -f "$TMP_MLANG"

# ── Branding (site name + logo + favicon) via docker cp into the container ──
log "applying branding"
BRAND_DIR="$(mktemp -d)"
LOGO_REL=""; LOGOCOMPACT_REL=""; FAVICON_REL=""
if [[ -n "${BRAND_LOGO:-}" && -f "${BRAND_LOGO}" ]]; then
    ext="${BRAND_LOGO##*.}"; cp -f "$BRAND_LOGO" "$BRAND_DIR/logo.${ext}"; LOGO_REL="logo.${ext}"
fi
if [[ -n "${BRAND_LOGOCOMPACT:-}" && -f "${BRAND_LOGOCOMPACT}" ]]; then
    ext="${BRAND_LOGOCOMPACT##*.}"; cp -f "$BRAND_LOGOCOMPACT" "$BRAND_DIR/logocompact.${ext}"; LOGOCOMPACT_REL="logocompact.${ext}"
fi
# If no compact logo was given, reuse the main logo for it — so a single upload
# shows in BOTH the navbar (compact) and the login page (full).
if [[ -z "$LOGOCOMPACT_REL" && -n "$LOGO_REL" ]]; then LOGOCOMPACT_REL="$LOGO_REL"; fi
if [[ -n "${BRAND_FAVICON:-}" && -f "${BRAND_FAVICON}" ]]; then
    ext="${BRAND_FAVICON##*.}"; cp -f "$BRAND_FAVICON" "$BRAND_DIR/favicon.${ext}"; FAVICON_REL="favicon.${ext}"
fi

B_FN_AR="${BRAND_FULLNAME_AR:-}"; B_FN_EN="${BRAND_FULLNAME_EN:-}"
if [[ -z "$B_FN_AR" && -z "$B_FN_EN" ]]; then B_FN_EN="$NAME"; fi

# Short name drives the navbar title. If the client didn't give one, fall back to
# the full name (then the <name> arg) so the navbar shows the academy — never the
# template's default "academy".
B_SN_AR="${BRAND_SHORTNAME_AR:-}"; B_SN_EN="${BRAND_SHORTNAME_EN:-}"
if [[ -z "$B_SN_AR" && -z "$B_SN_EN" ]]; then B_SN_AR="$B_FN_AR"; B_SN_EN="${B_FN_EN:-$NAME}"; fi

BRAND_FULLNAME_AR="$B_FN_AR" BRAND_FULLNAME_EN="$B_FN_EN" \
BRAND_SHORTNAME_AR="$B_SN_AR" BRAND_SHORTNAME_EN="$B_SN_EN" \
LOGO_REL="$LOGO_REL" LOGOCOMPACT_REL="$LOGOCOMPACT_REL" FAVICON_REL="$FAVICON_REL" \
python3 - "$BRAND_DIR/brand.json" <<'PYJSON'
import json, os, sys
d = {
    "fullname_ar":  os.environ.get("BRAND_FULLNAME_AR", ""),
    "fullname_en":  os.environ.get("BRAND_FULLNAME_EN", ""),
    "shortname_ar": os.environ.get("BRAND_SHORTNAME_AR", ""),
    "shortname_en": os.environ.get("BRAND_SHORTNAME_EN", ""),
}
if os.environ.get("LOGO_REL"):        d["logo"]        = os.environ["LOGO_REL"]
if os.environ.get("LOGOCOMPACT_REL"): d["logocompact"] = os.environ["LOGOCOMPACT_REL"]
if os.environ.get("FAVICON_REL"):     d["favicon"]     = os.environ["FAVICON_REL"]
json.dump(d, open(sys.argv[1], "w"), ensure_ascii=False)
PYJSON

docker exec "$CONTAINER" rm -rf /tmp/nit-brand || true
docker cp "$BRAND_DIR" "$CONTAINER:/tmp/nit-brand"
docker exec "$CONTAINER" php /var/www/html/public/theme/nit/cli/apply_brand.php \
    --manifest=/tmp/nit-brand/brand.json || echo "!! branding step failed (site still live)"
docker exec "$CONTAINER" rm -rf /tmp/nit-brand || true
rm -rf "$BRAND_DIR"

# ── Mark this academy as provisioned so the MOBILE APP treats it as live ─────
# theme_nit's site export reads theme_nit/provisioned; unset resolves to FALSE
# (get_config returns false, so the theme's `?? 1` never applies), which makes
# the app refuse to open the academy. Set it explicitly.
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=theme_nit --name=provisioned --set=1 || echo "!! could not set provisioned"

# ── Platform language (from the build form: ar | en | both) ──────────────────
_cfg(){ docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --name="$1" --set="$2" >/dev/null 2>&1 || true; }
# Force EVERY user's stored language to $1. langlist only limits the language
# MENU — it does NOT change a user whose profile lang is already something else
# (e.g. a Google-created account that picked up 'ar'). For an en-only / ar-only
# academy we pin all users so the whole UI is in the requested language.
_forcelang(){
    docker exec -e L="$1" "$CONTAINER" php -r 'define("CLI_SCRIPT",true); require("/var/www/html/config.php"); global $DB; $DB->execute("UPDATE {user} SET lang = ?", [getenv("L")]);' >/dev/null 2>&1 \
        || echo "!! could not force user language to $1"
}
case "${PLATFORM_LANG:-both}" in
    ar) log "language: Arabic only";  _cfg lang ar; _cfg langmenu 0; _cfg langlist ar; _cfg langdetect 0; _forcelang ar ;;
    en) log "language: English only"; _cfg lang en; _cfg langmenu 0; _cfg langlist en; _cfg langdetect 0; _forcelang en ;;
    *)  log "language: Arabic + English"; _cfg lang ar; _cfg langmenu 1; _cfg langlist "en,ar"; _cfg langdetect 1 ;;
esac

# ── App-friendly password policy ─────────────────────────────────────────────
# The stock policy demands upper+lower+digit+special, and core returns that
# failure as an HTML (<div>…) string the app can't present cleanly. Disable the
# complexity rules and keep a simple length floor so app self-registration works
# with ordinary passwords. Admins can still tighten it later per academy.
log "relaxing the password policy for app registration"
_cfg passwordpolicy 0
_cfg minpasswordlength 6
_cfg minpassworddigits 0
_cfg minpasswordlower 0
_cfg minpasswordupper 0
_cfg minpasswordnonalphanum 0

# ── Brand palette (theme_nit Brand Colors) — from the build form's 6 pickers ──
# BRAND_COLOR_* are #rrggbb. We set Group 1 (the site-wide default) roles from
# them and DERIVE the rest (accent-text, secondary text, borders) so the live
# site matches the preview. Other groups keep their defaults.
# Blend colour A toward colour B by ratio R (0..1) — background-aware, so the
# derived roles work for BOTH light and dark palettes.
_mix(){ docker exec -e A="$1" -e B="$2" -e R="$3" "$CONTAINER" php -r '$a=ltrim(getenv("A"),"#");$b=ltrim(getenv("B"),"#");$r=(float)getenv("R");$c=fn($h,$i)=>hexdec(substr($h,$i,2));printf("#%02x%02x%02x",(int)round($c($a,0)*(1-$r)+$c($b,0)*$r),(int)round($c($a,2)*(1-$r)+$c($b,2)*$r),(int)round($c($a,4)*(1-$r)+$c($b,4)*$r));' 2>/dev/null || echo "$1"; }
_setrole(){ docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=theme_nit --name="brandcolour_g1_$1" --set="$2" >/dev/null 2>&1 || echo "!! could not set brand $1"; }
if [[ -n "${BRAND_COLOR_PRIMARY:-}${BRAND_COLOR_SECONDARY:-}${BRAND_COLOR_BACKGROUND:-}${BRAND_COLOR_SURFACE:-}${BRAND_COLOR_TEXT:-}${BRAND_COLOR_ACCENT:-}" ]]; then
    log "applying brand palette"
    P="${BRAND_COLOR_PRIMARY:-#5488c4}"; SEC="${BRAND_COLOR_SECONDARY:-#1c2a3a}"
    BG="${BRAND_COLOR_BACKGROUND:-#0c141f}"; SURF="${BRAND_COLOR_SURFACE:-#121e2d}"
    TXT="${BRAND_COLOR_TEXT:-#eef3f9}"; ACC="${BRAND_COLOR_ACCENT:-$P}"
    _setrole primary "$P";  _setrole secondary "$SEC"; _setrole background "$BG"
    _setrole surface "$SURF"; _setrole textprimary "$TXT"; _setrole accent "$ACC"
    _setrole accenttext      "$(_mix "$ACC"  "$TXT" 0.30)"   # readable accent on the bg
    _setrole textsecondary   "$(_mix "$TXT"  "$BG"  0.42)"   # dimmer text toward the bg
    _setrole borderprimary   "$(_mix "$SURF" "$TXT" 0.12)"
    _setrole bordersecondary "$(_mix "$SURF" "$TXT" 0.24)"
    _setrole hoverbackground "$(_mix "$SURF" "$P"   0.14)"
    _setrole hovertext       "$TXT"
    docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
fi

# ── Hero cover image — swap the client's image into the front-page hero ──────
if [[ -n "${BRAND_HERO:-}" && -f "${BRAND_HERO}" && -f /root/apply_hero.php ]]; then
    log "applying hero cover image"
    HERO_IN="/var/www/moodledata/hero_upload.${BRAND_HERO##*.}"
    docker cp /root/apply_hero.php "$CONTAINER:/var/www/moodledata/apply_hero.php"
    docker cp "$BRAND_HERO" "$CONTAINER:$HERO_IN"
    docker exec -e HERO_IMAGE="$HERO_IN" "$CONTAINER" php /var/www/moodledata/apply_hero.php || echo "!! hero step failed (site still live)"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_hero.php "$HERO_IN" || true
fi

# ── About section — bullet points (chips) + photo into the about section ────
if [[ ( -n "${BRAND_ABOUT:-}" || -n "${BRAND_ABOUT_BULLETS:-}" ) && -f /root/apply_about.php ]]; then
    log "applying about section"
    docker cp /root/apply_about.php "$CONTAINER:/var/www/moodledata/apply_about.php"
    ABOUT_IN=""
    if [[ -n "${BRAND_ABOUT:-}" && -f "${BRAND_ABOUT}" ]]; then
        ABOUT_IN="/var/www/moodledata/about_upload.${BRAND_ABOUT##*.}"
        docker cp "$BRAND_ABOUT" "$CONTAINER:$ABOUT_IN"
    fi
    docker exec -e ABOUT_IMAGE="$ABOUT_IN" -e ABOUT_BULLETS="${BRAND_ABOUT_BULLETS:-}" \
        "$CONTAINER" php /var/www/moodledata/apply_about.php || echo "!! about step failed (site still live)"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_about.php "$ABOUT_IN" || true
fi

# ── Gallery images — fill the front-page gallery grid (comma-separated paths) ─
if [[ -n "${BRAND_GALLERY:-}" && -f /root/apply_gallery.php ]]; then
    log "applying gallery images"
    docker cp /root/apply_gallery.php "$CONTAINER:/var/www/moodledata/apply_gallery.php"
    GAL_IN=""; i=0
    IFS=',' read -ra _gpaths <<< "$BRAND_GALLERY"
    for gp in "${_gpaths[@]}"; do
        [[ -f "$gp" ]] || continue
        dest="/var/www/moodledata/gal_${i}.${gp##*.}"
        docker cp "$gp" "$CONTAINER:$dest"
        GAL_IN="${GAL_IN:+$GAL_IN,}$dest"; i=$((i+1))
    done
    if [[ -n "$GAL_IN" ]]; then
        docker exec -e GALLERY_IMAGES="$GAL_IN" "$CONTAINER" php /var/www/moodledata/apply_gallery.php || echo "!! gallery step failed (site still live)"
    fi
    docker exec "$CONTAINER" sh -c 'rm -f /var/www/moodledata/apply_gallery.php /var/www/moodledata/gal_*' || true
fi

# ── Login / signup page background image (theme_nit stored-file, not a section) ─
if [[ -n "${BRAND_LOGIN:-}" && -f "${BRAND_LOGIN}" && -f /root/apply_login.php ]]; then
    log "applying login background image"
    LOGIN_IN="/var/www/moodledata/login_upload.${BRAND_LOGIN##*.}"
    docker cp /root/apply_login.php "$CONTAINER:/var/www/moodledata/apply_login.php"
    docker cp "$BRAND_LOGIN" "$CONTAINER:$LOGIN_IN"
    docker exec -e LOGIN_IMAGE="$LOGIN_IN" "$CONTAINER" php /var/www/moodledata/apply_login.php || echo "!! login-bg step failed (site still live)"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_login.php "$LOGIN_IN" || true
fi

# ── Contact + social — phone / WhatsApp / social icons into the contact section
if [[ -n "${BRAND_CONTACT_PHONE:-}${BRAND_CONTACT_WHATSAPP:-}${BRAND_SOCIAL_FACEBOOK:-}${BRAND_SOCIAL_INSTAGRAM:-}${BRAND_SOCIAL_YOUTUBE:-}${BRAND_SOCIAL_TIKTOK:-}${BRAND_SOCIAL_WEBSITE:-}" && -f /root/apply_contact.php ]]; then
    log "applying contact + social"
    docker cp /root/apply_contact.php "$CONTAINER:/var/www/moodledata/apply_contact.php"
    docker exec \
        -e CONTACT_PHONE="${BRAND_CONTACT_PHONE:-}" -e CONTACT_WHATSAPP="${BRAND_CONTACT_WHATSAPP:-}" \
        -e SOCIAL_FACEBOOK="${BRAND_SOCIAL_FACEBOOK:-}" -e SOCIAL_INSTAGRAM="${BRAND_SOCIAL_INSTAGRAM:-}" \
        -e SOCIAL_YOUTUBE="${BRAND_SOCIAL_YOUTUBE:-}" -e SOCIAL_TIKTOK="${BRAND_SOCIAL_TIKTOK:-}" \
        -e SOCIAL_WEBSITE="${BRAND_SOCIAL_WEBSITE:-}" \
        -e ICON_COLOR="${BRAND_COLOR_PRIMARY:-}" \
        "$CONTAINER" php /var/www/moodledata/apply_contact.php || echo "!! contact step failed (site still live)"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_contact.php || true
fi

# ── Licence tier (local_license) ────────────────────────────────────────────
TIER="${LICENSE_TIER:-demo}"
case "$TIER" in demo|basic|standard|professional) ;; *) TIER="demo" ;; esac
log "setting local_license tier=$TIER (enforcement on)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=tier    --set="$TIER" || echo "!! could not set licence tier (site still live)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=enabled --set=1       || echo "!! could not enable licence enforcement"
docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=definition --set="${LICENSE_DEFINITION:-}" || echo "!! could not set licence definition"

# ── Global platform settings (local_multitopics) ────────────────────────────
for _skey in google_client_id google_client_secret apple_client_id facebook_app_id android_version android_url ios_version ios_url watermark_color watermark_speed watermark_fontsize app_name; do
    _senv="SETTING_$(echo "$_skey" | tr '[:lower:]' '[:upper:]')"
    _sval="${!_senv:-}"
    if [[ -n "$_sval" ]]; then
        log "setting local_multitopics/$_skey"
        docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_multitopics --name="$_skey" --set="$_sval" || echo "!! could not set $_skey"
    fi
done

# ── Google web login — only when BOTH an OAuth client id + secret are provided ─
if [[ -n "${SETTING_GOOGLE_CLIENT_ID:-}" && -n "${SETTING_GOOGLE_CLIENT_SECRET:-}" && -f /root/apply_google_login.php ]]; then
    log "enabling Sign in with Google"
    docker cp /root/apply_google_login.php "$CONTAINER:/var/www/moodledata/apply_google_login.php"
    docker exec \
        -e GOOGLE_CLIENT_ID="${SETTING_GOOGLE_CLIENT_ID}" \
        -e GOOGLE_CLIENT_SECRET="${SETTING_GOOGLE_CLIENT_SECRET}" \
        "$CONTAINER" php /var/www/moodledata/apply_google_login.php || echo "!! google-login step failed (site still live)"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_google_login.php || true
fi

# ── Legal links (app design-system links block) ─────────────────────────────
# Terms / Privacy / About / FAQ URLs served by design_system.php. A per-academy
# value (BRAND_LINK_*) wins; otherwise the shared platform default (SETTING_*_URL).
# Stored in theme_nit as link_<x>_en + link_<x>_ar (same URL for both languages).
_setlink(){  # $1 = base key (e.g. link_terms), $2 = url
    [[ -n "$2" ]] || return 0
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=theme_nit --name="${1}_en" --set="$2" >/dev/null 2>&1 || true
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=theme_nit --name="${1}_ar" --set="$2" >/dev/null 2>&1 || true
    log "set theme_nit/${1} = $2"
}
_setlink link_terms   "${BRAND_LINK_TERMS:-${SETTING_TERMS_URL:-}}"
_setlink link_privacy "${BRAND_LINK_PRIVACY:-${SETTING_PRIVACY_URL:-}}"
_setlink link_about   "${BRAND_LINK_ABOUT:-${SETTING_ABOUT_URL:-}}"
_setlink link_faq     "${BRAND_LINK_FAQ:-${SETTING_FAQ_URL:-}}"

docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true

# ── App web-service token — publish admin_token for getsettings.php / the app ─
if [[ -f /root/apply_apptoken.php ]]; then
    log "provisioning the mobile app web-service token"
    docker cp /root/apply_apptoken.php "$CONTAINER:/var/www/moodledata/apply_apptoken.php"
    docker exec "$CONTAINER" php /var/www/moodledata/apply_apptoken.php || echo "!! app-token step failed (site still live)"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_apptoken.php || true
fi

# ── Welcome: unique admin password + email the customer their login ─────────
# OWNER_EMAIL / OWNER_NAME / OWNER_LOCALE are passed by the provisioner (nit2).
# Gives each academy its own admin password (not the template's shared one),
# forces a change on first login, and emails the customer their credentials.
if [[ -f /root/send_welcome.php ]]; then
    log "setting admin credentials + emailing the customer"
    WELCOME_PASS="Nit-$(openssl rand -hex 6)"
    docker cp /root/send_welcome.php "$CONTAINER:/var/www/moodledata/send_welcome.php"
    docker exec \
        -e WELCOME_USER=admin -e WELCOME_PASS="$WELCOME_PASS" \
        -e OWNER_EMAIL="${OWNER_EMAIL:-}" -e OWNER_NAME="${OWNER_NAME:-}" -e OWNER_LOCALE="${OWNER_LOCALE:-ar}" \
        "$CONTAINER" php /var/www/moodledata/send_welcome.php || echo "!! welcome step failed (site still live)"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/send_welcome.php || true
else
    log "send_welcome.php not installed at /root — skipping welcome email"
fi

# ── 6. Apache vhost → enable → SSL → restart (identical to create.sh) ───────
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
echo "  container=$CONTAINER  port=$PORT  db=$DB_NAME  image=$IMAGE"
echo "============================================================"
