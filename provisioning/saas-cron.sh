#!/usr/bin/env bash
# ============================================================================
#  saas-cron.sh — run Moodle scheduled-task cron in EVERY running academy.
#
#  Moodle needs admin/cli/cron.php called ~every minute or nothing time-based
#  happens (queued email/notifications, backups, cleanup, enrolment expiry…).
#  The baked academies have no cron of their own, so one host timer drives them
#  all. Auto-discovers containers by name (saas_moodle_*), so new academies are
#  picked up with no per-tenant setup.
#
#  Concurrency-capped: all tenants share ONE MariaDB, so we never run more than
#  SAAS_CRON_CONCURRENCY academy crons at once — a stampede of 50 aligned crons
#  would hammer the shared DB. Each Moodle cron self-locks, so overlapping the
#  same tenant is safe; different tenants hit different schemas.
#
#  Invoked once per minute by the saas-cron.timer systemd unit (or a crontab
#  line: * * * * * /root/saas-cron.sh). Idempotent and fast when nothing is due.
# ============================================================================
set -uo pipefail

MAXJOBS="${SAAS_CRON_CONCURRENCY:-6}"

mapfile -t CONTAINERS < <(docker ps --format '{{.Names}}' | grep '^saas_moodle_' || true)
[[ ${#CONTAINERS[@]} -eq 0 ]] && exit 0

# Run as www-data (uid 33, the Apache user that owns moodledata) — running cron
# as root would create root-owned cache/temp files Apache then can't read.
printf '%s\n' "${CONTAINERS[@]}" \
    | xargs -r -P "$MAXJOBS" -I{} \
        docker exec -u www-data {} php /var/www/html/admin/cli/cron.php >/dev/null 2>&1

exit 0
