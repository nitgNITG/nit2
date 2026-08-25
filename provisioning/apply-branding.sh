#!/usr/bin/env bash
# ============================================================================
#  apply-branding.sh — RE-APPLY branding to an ALREADY-provisioned academy,
#  without recreating the branch / DB / container. Same BRAND_* / PLATFORM_LANG
#  env contract as create.sh's branding phase, so the dashboard can push updated
#  logo / colours / hero / about / gallery / contact / login / footer to a live
#  site. Only the values that are provided are applied; everything else is left
#  untouched. The footer is ensured (seeded if the academy predates it).
#
#  Usage:  BRAND_*=… PLATFORM_LANG=… bash apply-branding.sh <slug>
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash apply-branding.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

# ── Site name + logo + favicon (only when at least one is provided) ──────────
if [[ -n "${BRAND_FULLNAME_AR:-}${BRAND_FULLNAME_EN:-}${BRAND_SHORTNAME_AR:-}${BRAND_SHORTNAME_EN:-}${BRAND_LOGO:-}${BRAND_LOGOCOMPACT:-}${BRAND_FAVICON:-}" ]]; then
    log "applying branding (name / logo / favicon)"
    BRAND_DIR="$(mktemp -d)"
    LOGO_REL=""; LOGOCOMPACT_REL=""; FAVICON_REL=""
    if [[ -n "${BRAND_LOGO:-}" && -f "${BRAND_LOGO}" ]]; then
        ext="${BRAND_LOGO##*.}"; cp -f "$BRAND_LOGO" "$BRAND_DIR/logo.${ext}"; LOGO_REL="logo.${ext}"
    fi
    if [[ -n "${BRAND_LOGOCOMPACT:-}" && -f "${BRAND_LOGOCOMPACT}" ]]; then
        ext="${BRAND_LOGOCOMPACT##*.}"; cp -f "$BRAND_LOGOCOMPACT" "$BRAND_DIR/logocompact.${ext}"; LOGOCOMPACT_REL="logocompact.${ext}"
    fi
    if [[ -z "$LOGOCOMPACT_REL" && -n "$LOGO_REL" ]]; then LOGOCOMPACT_REL="$LOGO_REL"; fi
    if [[ -n "${BRAND_FAVICON:-}" && -f "${BRAND_FAVICON}" ]]; then
        ext="${BRAND_FAVICON##*.}"; cp -f "$BRAND_FAVICON" "$BRAND_DIR/favicon.${ext}"; FAVICON_REL="favicon.${ext}"
    fi

    BRAND_FULLNAME_AR="${BRAND_FULLNAME_AR:-}" BRAND_FULLNAME_EN="${BRAND_FULLNAME_EN:-}" \
    BRAND_SHORTNAME_AR="${BRAND_SHORTNAME_AR:-}" BRAND_SHORTNAME_EN="${BRAND_SHORTNAME_EN:-}" \
    LOGO_REL="$LOGO_REL" LOGOCOMPACT_REL="$LOGOCOMPACT_REL" FAVICON_REL="$FAVICON_REL" \
    python3 - "$BRAND_DIR/brand.json" <<'PYJSON'
import json, os, sys
d = {}
for k in ("fullname_ar", "fullname_en", "shortname_ar", "shortname_en"):
    v = os.environ.get("BRAND_" + k.upper(), "")
    if v: d[k] = v
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
fi

# ── Platform language (ar | en | both) ──────────────────────────────────────
_cfg(){ docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --name="$1" --set="$2" >/dev/null 2>&1 || true; }
if [[ -n "${PLATFORM_LANG:-}" ]]; then
    case "$PLATFORM_LANG" in
        ar) log "language: Arabic only";  _cfg lang ar; _cfg langmenu 0; _cfg langlist ar ;;
        en) log "language: English only"; _cfg lang en; _cfg langmenu 0; _cfg langlist en ;;
        *)  log "language: Arabic + English"; _cfg lang ar; _cfg langmenu 1; _cfg langlist "en,ar" ;;
    esac
fi

# ── Brand palette (theme_nit Brand Colors, Group 1) ─────────────────────────
_mix(){ docker exec -e A="$1" -e B="$2" -e R="$3" "$CONTAINER" php -r '$a=ltrim(getenv("A"),"#");$b=ltrim(getenv("B"),"#");$r=(float)getenv("R");$c=fn($h,$i)=>hexdec(substr($h,$i,2));printf("#%02x%02x%02x",(int)round($c($a,0)*(1-$r)+$c($b,0)*$r),(int)round($c($a,2)*(1-$r)+$c($b,2)*$r),(int)round($c($a,4)*(1-$r)+$c($b,4)*$r));' 2>/dev/null || echo "$1"; }
_setrole(){ docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=theme_nit --name="brandcolour_g1_$1" --set="$2" >/dev/null 2>&1 || echo "!! could not set brand $1"; }
if [[ -n "${BRAND_COLOR_PRIMARY:-}${BRAND_COLOR_SECONDARY:-}${BRAND_COLOR_BACKGROUND:-}${BRAND_COLOR_SURFACE:-}${BRAND_COLOR_TEXT:-}${BRAND_COLOR_ACCENT:-}" ]]; then
    log "applying brand palette"
    P="${BRAND_COLOR_PRIMARY:-#5488c4}"; SEC="${BRAND_COLOR_SECONDARY:-#1c2a3a}"
    BG="${BRAND_COLOR_BACKGROUND:-#0c141f}"; SURF="${BRAND_COLOR_SURFACE:-#121e2d}"
    TXT="${BRAND_COLOR_TEXT:-#eef3f9}"; ACC="${BRAND_COLOR_ACCENT:-$P}"
    _setrole primary "$P";  _setrole secondary "$SEC"; _setrole background "$BG"
    _setrole surface "$SURF"; _setrole textprimary "$TXT"; _setrole accent "$ACC"
    _setrole accenttext      "$(_mix "$ACC"  "$TXT" 0.30)"
    _setrole textsecondary   "$(_mix "$TXT"  "$BG"  0.42)"
    _setrole borderprimary   "$(_mix "$SURF" "$TXT" 0.12)"
    _setrole bordersecondary "$(_mix "$SURF" "$TXT" 0.24)"
    _setrole hoverbackground "$(_mix "$SURF" "$P"   0.14)"
    _setrole hovertext       "$TXT"
fi

# ── Hero cover image ────────────────────────────────────────────────────────
if [[ -n "${BRAND_HERO:-}" && -f "${BRAND_HERO}" && -f /root/apply_hero.php ]]; then
    log "applying hero cover image"
    HERO_IN="/var/www/moodledata/hero_upload.${BRAND_HERO##*.}"
    docker cp /root/apply_hero.php "$CONTAINER:/var/www/moodledata/apply_hero.php"
    docker cp "$BRAND_HERO" "$CONTAINER:$HERO_IN"
    docker exec -e HERO_IMAGE="$HERO_IN" "$CONTAINER" php /var/www/moodledata/apply_hero.php || echo "!! hero step failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_hero.php "$HERO_IN" || true
fi

# ── About (image + bullet points) ───────────────────────────────────────────
if [[ ( -n "${BRAND_ABOUT:-}" || -n "${BRAND_ABOUT_BULLETS:-}" ) && -f /root/apply_about.php ]]; then
    log "applying about section"
    docker cp /root/apply_about.php "$CONTAINER:/var/www/moodledata/apply_about.php"
    ABOUT_IN=""
    if [[ -n "${BRAND_ABOUT:-}" && -f "${BRAND_ABOUT}" ]]; then
        ABOUT_IN="/var/www/moodledata/about_upload.${BRAND_ABOUT##*.}"
        docker cp "$BRAND_ABOUT" "$CONTAINER:$ABOUT_IN"
    fi
    docker exec -e ABOUT_IMAGE="$ABOUT_IN" -e ABOUT_BULLETS="${BRAND_ABOUT_BULLETS:-}" \
        "$CONTAINER" php /var/www/moodledata/apply_about.php || echo "!! about step failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_about.php "$ABOUT_IN" || true
fi

# ── Gallery ─────────────────────────────────────────────────────────────────
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
        docker exec -e GALLERY_IMAGES="$GAL_IN" "$CONTAINER" php /var/www/moodledata/apply_gallery.php || echo "!! gallery step failed"
    fi
    docker exec "$CONTAINER" sh -c 'rm -f /var/www/moodledata/apply_gallery.php /var/www/moodledata/gal_*' || true
fi

# ── Login / signup background image ─────────────────────────────────────────
if [[ -n "${BRAND_LOGIN:-}" && -f "${BRAND_LOGIN}" && -f /root/apply_login.php ]]; then
    log "applying login background image"
    LOGIN_IN="/var/www/moodledata/login_upload.${BRAND_LOGIN##*.}"
    docker cp /root/apply_login.php "$CONTAINER:/var/www/moodledata/apply_login.php"
    docker cp "$BRAND_LOGIN" "$CONTAINER:$LOGIN_IN"
    docker exec -e LOGIN_IMAGE="$LOGIN_IN" "$CONTAINER" php /var/www/moodledata/apply_login.php || echo "!! login-bg step failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_login.php "$LOGIN_IN" || true
fi

# ── Contact + social ────────────────────────────────────────────────────────
if [[ -n "${BRAND_CONTACT_PHONE:-}${BRAND_CONTACT_WHATSAPP:-}${BRAND_SOCIAL_FACEBOOK:-}${BRAND_SOCIAL_INSTAGRAM:-}${BRAND_SOCIAL_YOUTUBE:-}${BRAND_SOCIAL_TIKTOK:-}${BRAND_SOCIAL_WEBSITE:-}" && -f /root/apply_contact.php ]]; then
    log "applying contact + social"
    docker cp /root/apply_contact.php "$CONTAINER:/var/www/moodledata/apply_contact.php"
    docker exec \
        -e CONTACT_PHONE="${BRAND_CONTACT_PHONE:-}" -e CONTACT_WHATSAPP="${BRAND_CONTACT_WHATSAPP:-}" \
        -e SOCIAL_FACEBOOK="${BRAND_SOCIAL_FACEBOOK:-}" -e SOCIAL_INSTAGRAM="${BRAND_SOCIAL_INSTAGRAM:-}" \
        -e SOCIAL_YOUTUBE="${BRAND_SOCIAL_YOUTUBE:-}" -e SOCIAL_TIKTOK="${BRAND_SOCIAL_TIKTOK:-}" \
        -e SOCIAL_WEBSITE="${BRAND_SOCIAL_WEBSITE:-}" \
        "$CONTAINER" php /var/www/moodledata/apply_contact.php || echo "!! contact step failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_contact.php || true
fi

# ── Footer — ensure the front page has one (seed if the academy predates it) ─
if [[ -f /root/apply_footer.php ]]; then
    log "ensuring footer section"
    docker cp /root/apply_footer.php "$CONTAINER:/var/www/moodledata/apply_footer.php"
    docker exec "$CONTAINER" php /var/www/moodledata/apply_footer.php || echo "!! footer step failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_footer.php || true
fi

docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "branding re-applied to $SLUG"
