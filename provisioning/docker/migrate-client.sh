#!/usr/bin/env bash
# ============================================================================
#  migrate-client.sh — convert ONE existing client from the bind-mount model
#  (own 700 MB code/ copy) to the baked-image model (config.php + moodledata only).
#
#  Safe + reversible until the last step: the database and moodledata are never
#  touched; only the container is recreated. The 700 MB code/ folder is deleted
#  ONLY after the recreated site answers HTTP OK (unless KEEP_CODE=1).
#
#  Usage:   SAAS_IMAGE=saas-moodle:2026.08 bash migrate-client.sh <slug>
#           KEEP_CODE=1 ...   # recreate but DON'T delete code/ (inspect first)
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

ROOT="/opt/saas"
NET="saas_net"
IMAGE="${SAAS_IMAGE:-saas-moodle:latest}"

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash migrate-client.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
CLIENT_DIR="$ROOT/clients/$SLUG"
CODE_DIR="$CLIENT_DIR/code"
DATA_DIR="$CLIENT_DIR/moodledata"
CONF="$CLIENT_DIR/config.php"

docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER not found"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "image '$IMAGE' not found — build it first"
[[ -f "$CODE_DIR/config.php" ]] || die "no $CODE_DIR/config.php — is this a bind-mount client?"

PORT="$(docker inspect -f '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' "$CONTAINER" 2>/dev/null || true)"
[[ -n "$PORT" ]] || die "could not read host port for $CONTAINER"

# 1. Lift config.php out of the code dir to the per-client location.
log "extracting config.php -> $CONF"
cp -f "$CODE_DIR/config.php" "$CONF"

# 2. Recreate the container from the baked image, same port + moodledata.
log "recreating $CONTAINER from $IMAGE on 127.0.0.1:$PORT"
docker rm -f "$CONTAINER" >/dev/null
docker run -d --name "$CONTAINER" --network "$NET" --restart unless-stopped \
    -v "$CONF":/var/www/html/config.php:ro \
    -v "$DATA_DIR":/var/www/moodledata \
    -p "127.0.0.1:$PORT:80" \
    "$IMAGE" >/dev/null
sleep 6

docker exec "$CONTAINER" php /var/www/html/admin/cli/upgrade.php --non-interactive || true
docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true

# 3. Health check before deleting anything.
CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || echo 000)"
log "health check http://127.0.0.1:$PORT/ -> $CODE"
case "$CODE" in
    200|301|302|303)
        if [[ "${KEEP_CODE:-0}" == "1" ]]; then
            log "site OK — KEEP_CODE=1, leaving $CODE_DIR in place"
            NOTE="code/ kept (KEEP_CODE=1) — remove it manually when satisfied: rm -rf $CODE_DIR"
        else
            log "site OK — reclaiming space: rm -rf $CODE_DIR"
            rm -rf "$CODE_DIR"
            NOTE="code/ removed."
        fi
        echo "============================================================"
        echo "  $SLUG migrated to baked image ($IMAGE)."
        echo "  $NOTE"
        echo "============================================================"
        ;;
    *)
        echo "!! health check returned $CODE — NOT deleting code/."
        echo "!! inspect the site; to roll back, recreate with the old bind mount:"
        echo "!!   docker rm -f $CONTAINER"
        echo "!!   docker run -d --name $CONTAINER --network $NET --restart unless-stopped \\"
        echo "!!     -v $CODE_DIR:/var/www/html -v $DATA_DIR:/var/www/moodledata \\"
        echo "!!     -p 127.0.0.1:$PORT:80 moodle-new:latest"
        exit 1
        ;;
esac
