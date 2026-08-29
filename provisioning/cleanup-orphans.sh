#!/usr/bin/env bash
# ============================================================================
#  cleanup-orphans.sh — drop shared-DB schemas (and their scoped users) that no
#  longer have a running/created academy container. One-time hygiene sweep for
#  the schemas that piled up before destroy.sh learned to drop the DB+user.
#
#  SAFE BY DEFAULT: dry-run. It prints what it WOULD drop and changes nothing.
#  Re-run with --yes to actually drop. Always eyeball the dry-run list first.
#
#  How "orphan" is decided (robustly, no guessing):
#    - the LIVE set = every existing `saas_moodle_<slug>` container, mapped to the
#      schema create.sh would have made: moodle_${slug//-/_}
#    - any `moodle_%` schema NOT in that set is an orphan.
#
#  Usage:
#    sudo bash cleanup-orphans.sh            # dry-run — list orphans only
#    sudo bash cleanup-orphans.sh --yes      # actually drop them
# ============================================================================
set -uo pipefail

ROOT="${SAAS_ROOT:-/var/www/html/saas}"
DB_CONTAINER="saas_mariadb"
APPLY=0
[[ "${1:-}" == "--yes" ]] && APPLY=1

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

[[ -f "$ROOT/saas.env" ]] || die "no $ROOT/saas.env (DB_ROOT_PW) — run this on server B as root"
# shellcheck disable=SC1091
source "$ROOT/saas.env"
[[ -n "${DB_ROOT_PW:-}" ]] || die "DB_ROOT_PW unset in saas.env"
docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" || die "shared DB $DB_CONTAINER not running"

myq(){ docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" -N -e "$1" 2>/dev/null; }

# ── LIVE set: schema each existing academy container maps to ─────────────────
declare -A LIVE=()
while read -r name; do
    [[ -n "$name" ]] || continue
    slug="${name#saas_moodle_}"
    LIVE["moodle_${slug//-/_}"]=1
done < <(docker ps -a --format '{{.Names}}' | grep '^saas_moodle_' || true)

log "live academies: ${#LIVE[@]} → schemas: ${!LIVE[*]:-(none)}"

# ── All academy schemas in the shared DB ────────────────────────────────────
ORPHANS=()
while read -r db; do
    [[ -n "$db" ]] || continue
    case "$db" in information_schema|performance_schema|mysql|sys) continue ;; esac
    [[ "$db" == moodle_* ]] || continue          # only academy schemas
    if [[ -z "${LIVE[$db]:-}" ]]; then ORPHANS+=("$db"); fi
done < <(myq "SHOW DATABASES;")

if [[ ${#ORPHANS[@]} -eq 0 ]]; then
    log "no orphan schemas — nothing to do."
    exit 0
fi

echo
echo "Orphan schemas (no matching saas_moodle_* container):"
for db in "${ORPHANS[@]}"; do
    sz=$(myq "SELECT ROUND(SUM(data_length+index_length)/1024/1024,1) FROM information_schema.tables WHERE table_schema='$db';")
    echo "  - $db  (~${sz:-0} MB)"
done
echo

if [[ "$APPLY" != "1" ]]; then
    echo "DRY-RUN. Nothing dropped. Re-run with --yes to drop the ${#ORPHANS[@]} schema(s) above"
    echo "(each schema and its same-named scoped user 'moodle_<slug>'@'%' will be removed)."
    exit 0
fi

for db in "${ORPHANS[@]}"; do
    log "dropping $db + user '$db'@'%'"
    myq "DROP DATABASE IF EXISTS \`$db\`; DROP USER IF EXISTS '$db'@'%'; FLUSH PRIVILEGES;" \
        && echo "   dropped $db" || echo "   !! failed on $db"
done

echo
echo "============================================================"
echo "  removed ${#ORPHANS[@]} orphan schema(s)."
echo "  NOTE: the legacy shared 'moodle'@'%' user was left in place —"
echo "  older academies still use it. Remove it only after every academy"
echo "  has been recreated onto a per-academy user (check each config.php)."
echo "============================================================"
