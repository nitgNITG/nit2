#!/usr/bin/env bash
# ============================================================================
#  destroy-store.sh — remove ONE store completely: compose project (containers,
#  private network, uploads volume), database + user, host vhost + cert (the
#  custom domain's too), its media on the platform Cloudinary (stores/<slug>/),
#  clients/<slug>/, its staging dir and its nginx backups.
#
#  Usage:  bash destroy-store.sh <slug>
#
#  A MISSING piece is skipped, so it is safe on a half-created store and safe to
#  re-run. A step that FAILS on something that is there is recorded, the rest
#  still runs, and the job ends FAILED (not done) — nit2 keeps the tenant in
#  "deleting" and alerts, instead of dropping the row over a half-removed store.
# ============================================================================
set -uo pipefail   # NOT -e: cleanup continues past a missing piece.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
DB_CONTAINER="${SAAS_DB_CONTAINER:-saas_mariadb}"
BACKUP_ROOT="${NGINX_BACKUP_DIR:-/var/backups/saas-store-nginx}"   # storefront.sh's backups
TOTAL=6
FAILED=()
failed(){ warn "$*"; FAILED+=("$*"); }

report_step 1 $TOTAL "Stopping containers"
if [[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]]; then
    compose down -v --remove-orphans >/dev/null 2>&1 || failed "compose down failed for $PROJECT"
else
    # No files left (or never written): remove whatever carries the project label.
    docker ps -aq --filter "label=com.docker.compose.project=$PROJECT" | xargs -r docker rm -f >/dev/null 2>&1 || true
    docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" | xargs -r docker volume rm >/dev/null 2>&1 || true
    docker network rm "${PROJECT}_store" >/dev/null 2>&1 || true
fi
# Whatever path we took, nothing of the project may be left.
if [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT" 2>/dev/null)" ]]; then
    failed "containers of $PROJECT are still there"
fi

report_step 2 $TOTAL "Dropping database $DB_NAME"
if [[ -n "${DB_ROOT_PW:-}" ]] && docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" >/dev/null 2>&1 <<SQL || failed "failed to drop $DB_NAME"
DROP DATABASE IF EXISTS \`$DB_NAME\`;
DROP USER IF EXISTS '$DB_USER'@'%';
FLUSH PRIVILEGES;
SQL
else
    # Not "missing": the database may well exist — we just could not reach it.
    failed "shared DB unavailable or DB_ROOT_PW unset — $DB_NAME was NOT dropped"
fi

report_step 3 $TOTAL "Removing $HOST from the proxy"
bash "$SCRIPTS_DIR/proxy/proxy.sh" remove "$SLUG" "$HOST" || failed "proxy removal failed for $HOST"
# A custom domain bound to this store goes too.
if [[ -f "$CLIENT_DIR/domain-status.json" ]]; then
    CUSTOM="$(json_get "$(cat "$CLIENT_DIR/domain-status.json")" domain)"
    if [[ -n "$CUSTOM" ]]; then
        bash "$SCRIPTS_DIR/proxy/proxy.sh" remove "$SLUG" "$CUSTOM" || failed "proxy removal failed for $CUSTOM"
    fi
fi

report_step 4 $TOTAL "Deleting media (Cloudinary stores/$SLUG/)"
bash "$SCRIPTS_DIR/delete-media.sh" "$SLUG" || failed "Cloudinary media under stores/$SLUG/ was not fully deleted"

report_step 5 $TOTAL "Removing files"
rm -rf "$CLIENT_DIR" "$STORE_ROOT/staging/$SLUG" || failed "failed to remove $CLIENT_DIR"
rm -rf "${BACKUP_ROOT:?}/$SLUG" 2>/dev/null || true

if [[ ${#FAILED[@]} -gt 0 ]]; then
    MSG="teardown incomplete: $(IFS='; '; echo "${FAILED[*]}")"
    report_failed "$MSG"
    log "store $SLUG NOT fully destroyed — fix the cause and run it again (safe to re-run)"
    exit 1
fi
report_step 6 $TOTAL "Destroyed"
report_done "" '"destroyed":true'
log "store $SLUG destroyed"
