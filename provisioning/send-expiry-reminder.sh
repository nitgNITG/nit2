#!/usr/bin/env bash
# ============================================================================
#  send-expiry-reminder.sh — email an academy's OWNER that the subscription is
#  about to expire (or has expired), via the academy's own Moodle mail. Called by
#  the provisioning server's /expiry-reminder/<slug> endpoint (driven by nit2's
#  daily expiry cron). Reuses the send_welcome email path — no mail stack in nit2.
#
#  Env:
#    DAYS_LEFT   days until expiry (0/negative = expired)   [required]
#    RENEW_URL   renew link shown in the email               [optional]
#
#  Usage:  DAYS_LEFT=7 RENEW_URL=... bash send-expiry-reminder.sh <slug>
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash send-expiry-reminder.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

[[ -f /root/send_expiry_reminder.php ]] || die "/root/send_expiry_reminder.php not installed"

log "expiry reminder for $SLUG (days_left=${DAYS_LEFT:-?}, expiry=${EXPIRY_DATE:-}, email=${SEND_EMAIL:-1})"
docker cp /root/send_expiry_reminder.php "$CONTAINER:/var/www/moodledata/send_expiry_reminder.php"
docker exec \
    -e DAYS_LEFT="${DAYS_LEFT:-0}" -e RENEW_URL="${RENEW_URL:-}" \
    -e EXPIRY_DATE="${EXPIRY_DATE:-}" -e SEND_EMAIL="${SEND_EMAIL:-1}" \
    "$CONTAINER" php /var/www/moodledata/send_expiry_reminder.php || echo "!! reminder step failed"
docker exec "$CONTAINER" rm -f /var/www/moodledata/send_expiry_reminder.php || true
log "done — expiry reminder for $SLUG"
