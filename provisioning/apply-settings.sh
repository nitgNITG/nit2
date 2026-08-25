#!/usr/bin/env bash
# ============================================================================
#  apply-settings.sh — (re)apply the global platform settings (local_multitopics)
#  to an ALREADY-provisioned academy. Same SETTING_<KEY> env contract as create.sh,
#  so a global value that changed in the dashboard can be pushed to a live site.
#
#  Usage:   SETTING_GOOGLE_CLIENT_ID=… SETTING_IOS_URL=… bash apply-settings.sh <slug>
#  Only the SETTING_* vars that are present (non-empty) are applied.
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash apply-settings.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

applied=0
for _skey in google_client_id google_client_secret apple_client_id facebook_app_id android_version android_url ios_version ios_url watermark_color watermark_speed watermark_fontsize; do
    _senv="SETTING_$(echo "$_skey" | tr '[:lower:]' '[:upper:]')"
    _sval="${!_senv:-}"
    if [[ -n "$_sval" ]]; then
        log "setting local_multitopics/$_skey"
        docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_multitopics --name="$_skey" --set="$_sval" \
            && applied=$((applied + 1)) || echo "!! could not set $_skey"
    fi
done

# Google web login — (re)configure when both id + secret are present.
if [[ -n "${SETTING_GOOGLE_CLIENT_ID:-}" && -n "${SETTING_GOOGLE_CLIENT_SECRET:-}" && -f /root/apply_google_login.php ]]; then
    log "enabling Sign in with Google"
    docker cp /root/apply_google_login.php "$CONTAINER:/var/www/moodledata/apply_google_login.php"
    docker exec \
        -e GOOGLE_CLIENT_ID="${SETTING_GOOGLE_CLIENT_ID}" \
        -e GOOGLE_CLIENT_SECRET="${SETTING_GOOGLE_CLIENT_SECRET}" \
        "$CONTAINER" php /var/www/moodledata/apply_google_login.php \
        && applied=$((applied + 1)) || echo "!! google-login step failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_google_login.php || true
fi

docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "applied $applied setting(s) to $SLUG"
