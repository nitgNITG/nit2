#!/usr/bin/env bash
# ============================================================================
#  reset-welcome.sh — set a NEW password on a LIVE academy's OWNER account and
#  re-send the welcome email. Used to recover access when the original welcome
#  email is lost (or the owner forgot a password they changed).
#
#  Resets the restricted OWNER account (Academy Manager), NOT the NIT super-admin
#  `admin` account. The new password is supplied by the caller (nit2 generates it
#  so it can store it encrypted): OWNER_PASS. Optional OWNER_EMAIL / OWNER_NAME /
#  OWNER_LOCALE target the email like create.sh does.
#
#  The app token belongs to the `admin` account, which we do NOT touch here, so
#  the token survives — but we re-mint it afterwards as a harmless safety.
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

# 0) Make sure the restricted owner role exists (created at provision; also lets
#    this recover/migrate an academy provisioned before the role model existed).
if [[ -f /root/ensure_owner_role.php ]]; then
    docker cp /root/ensure_owner_role.php "$CONTAINER:/var/www/moodledata/ensure_owner_role.php"
    docker exec "$CONTAINER" php /var/www/moodledata/ensure_owner_role.php || echo "!! owner-role step failed"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/ensure_owner_role.php || true
fi

# 1) Reset the OWNER account password (+ email). ADMIN_PASS is intentionally NOT
#    passed, so the NIT super-admin `admin` account is left untouched.
if [[ -f /root/send_welcome.php ]]; then
    log "resetting owner password for $SLUG"
    docker cp /root/send_welcome.php "$CONTAINER:/var/www/moodledata/send_welcome.php"
    docker exec \
        -e OWNER_USER="${OWNER_USER:-owner}" -e OWNER_PASS="$OWNER_PASS" -e OWNER_ROLE="${OWNER_ROLE:-academymanager}" \
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
log "done — owner password reset for $SLUG"
