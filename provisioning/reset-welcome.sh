#!/usr/bin/env bash
# ============================================================================
#  reset-welcome.sh — set a NEW admin password on a LIVE academy and re-send the
#  welcome email. Used to recover access when the original welcome email is lost
#  (or the owner forgot a password they changed).
#
#  The new password is supplied by the caller (nit2 generates it so it can store
#  it encrypted): OWNER_PASS. Optional OWNER_EMAIL / OWNER_NAME / OWNER_LOCALE
#  target the email like create.sh does.
#
#  IMPORTANT: changing the admin password makes Moodle delete that user's
#  web-service tokens, so this re-mints the mobile app token afterwards (same
#  ordering lesson as create.sh) — otherwise the app would break with invalidtoken.
#
#  Usage:  OWNER_PASS=... [OWNER_EMAIL=...] bash reset-welcome.sh <slug>
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash reset-welcome.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"
[[ -n "${OWNER_PASS:-}" ]] || die "OWNER_PASS not set"

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

# 1) Set the new admin password (+ email) via the same script create.sh uses.
if [[ -f /root/send_welcome.php ]]; then
    log "resetting admin password for $SLUG"
    docker cp /root/send_welcome.php "$CONTAINER:/var/www/moodledata/send_welcome.php"
    docker exec \
        -e WELCOME_USER=admin -e WELCOME_PASS="$OWNER_PASS" \
        -e OWNER_EMAIL="${OWNER_EMAIL:-}" -e OWNER_NAME="${OWNER_NAME:-}" -e OWNER_LOCALE="${OWNER_LOCALE:-ar}" \
        "$CONTAINER" php /var/www/moodledata/send_welcome.php || echo "!! send_welcome failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/send_welcome.php || true
else
    die "/root/send_welcome.php not installed"
fi

# 2) Re-mint the app token — the password change above wiped the admin's tokens.
if [[ -f /root/apply_apptoken.php ]]; then
    log "re-minting the mobile app token after the password change"
    docker cp /root/apply_apptoken.php "$CONTAINER:/var/www/moodledata/apply_apptoken.php"
    docker exec "$CONTAINER" php /var/www/moodledata/apply_apptoken.php || echo "!! app-token re-mint failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/apply_apptoken.php || true
fi

docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "done — admin password reset for $SLUG"
