#!/usr/bin/env bash
# ============================================================================
#  destroy-store.sh — remove ONE store completely: compose project (containers,
#  private network, uploads volume), database + user, host vhost + cert,
#  clients/<slug>/ and its staging dir. Continues past missing pieces, so it is
#  safe to run on a half-created store.
#
#  Usage:  bash destroy-store.sh <slug>
# ============================================================================
set -uo pipefail   # NOT -e: cleanup continues past a missing piece.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
DB_CONTAINER="${SAAS_DB_CONTAINER:-saas_mariadb}"
TOTAL=5

report_step 1 $TOTAL "Stopping containers"
if [[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]]; then
    compose down -v --remove-orphans >/dev/null 2>&1 || warn "compose down failed for $PROJECT"
else
    # No files left (or never written): remove whatever carries the project label.
    docker ps -aq --filter "label=com.docker.compose.project=$PROJECT" | xargs -r docker rm -f >/dev/null 2>&1 || true
    docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" | xargs -r docker volume rm >/dev/null 2>&1 || true
    docker network rm "${PROJECT}_store" >/dev/null 2>&1 || true
fi

report_step 2 $TOTAL "Dropping database $DB_NAME"
if [[ -n "${DB_ROOT_PW:-}" ]] && docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    docker exec -i "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PW" >/dev/null 2>&1 <<SQL || warn "failed to drop $DB_NAME"
DROP DATABASE IF EXISTS \`$DB_NAME\`;
DROP USER IF EXISTS '$DB_USER'@'%';
FLUSH PRIVILEGES;
SQL
else
    warn "shared DB unavailable or DB_ROOT_PW unset — skipping database drop"
fi

report_step 3 $TOTAL "Removing $HOST from the proxy"
bash "$SCRIPTS_DIR/proxy/proxy.sh" remove "$SLUG" "$HOST" || warn "proxy removal failed"
# A custom domain bound to this store goes too.
if [[ -f "$CLIENT_DIR/domain-status.json" ]]; then
    CUSTOM="$(json_get "$(cat "$CLIENT_DIR/domain-status.json")" domain)"
    if [[ -n "$CUSTOM" ]]; then
        bash "$SCRIPTS_DIR/proxy/proxy.sh" remove "$SLUG" "$CUSTOM" || warn "custom domain removal failed"
    fi
fi

report_step 4 $TOTAL "Removing files"
rm -rf "$CLIENT_DIR" "$STORE_ROOT/staging/$SLUG" || warn "failed to remove $CLIENT_DIR"

report_step 5 $TOTAL "Destroyed"
report_done "" '"destroyed":true'
log "store $SLUG destroyed"
