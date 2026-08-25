#!/usr/bin/env bash
# ============================================================================
#  update-image.sh — re-create ONE already-baked academy's container onto the
#  target image (SAAS_IMAGE), WITHOUT touching its database or moodledata.
#  Used to roll a live academy forward to a new baked image (theme / core /
#  plugin changes that ship inside the image, e.g. the login background or the
#  hero-gap fix) without deleting + rebuilding the site.
#
#  Safe + reversible: only the container is recreated (config.php + moodledata
#  are mounted, not copied). If the new image fails its health check, the
#  container is rolled back to the image it was running before.
#
#  Usage:  SAAS_IMAGE=ghcr.io/nitgg/saas-moodle:2026.08.2 bash update-image.sh <slug>
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

ROOT="${SAAS_ROOT:-/var/www/html/saas}"
NET="saas_net"
IMAGE="${SAAS_IMAGE:-ghcr.io/nitgg/saas-moodle:latest}"

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash update-image.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
CLIENT_DIR="$ROOT/clients/$SLUG"
DATA_DIR="$CLIENT_DIR/moodledata"
CONF="$CLIENT_DIR/config.php"

docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER not found"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "image '$IMAGE' not found — pull it first (docker pull $IMAGE)"

# A per-client config.php means this is a baked (image) academy. Custom-code
# clients bind-mount /var/www/html and manage their own code — refuse those
# (update them with update-site.sh / git pull instead).
[[ -f "$CONF" ]] || die "no $CONF — not a baked academy (custom-code clients update via update-site.sh)"

# Read the current image + host port so we can preserve the port and roll back.
OLD_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
PORT="$(docker inspect -f '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' "$CONTAINER" 2>/dev/null || true)"
[[ -n "$PORT" ]] || die "could not read host port for $CONTAINER"

if [[ "$OLD_IMAGE" == "$IMAGE" ]]; then
    log "$CONTAINER already runs $IMAGE — recreating anyway to pick up a re-pulled tag"
fi

_run_on(){  # $1 = image
    docker run -d --name "$CONTAINER" --network "$NET" --restart unless-stopped \
        -v "$CONF":/var/www/html/config.php:ro \
        -v "$DATA_DIR":/var/www/moodledata \
        -p "127.0.0.1:$PORT:80" \
        "$1" >/dev/null
}

log "recreating $CONTAINER: $OLD_IMAGE -> $IMAGE on 127.0.0.1:$PORT"
docker rm -f "$CONTAINER" >/dev/null
_run_on "$IMAGE"
sleep 6

# The new image may carry DB schema changes (new plugin versions, etc.).
docker exec "$CONTAINER" php /var/www/html/admin/cli/upgrade.php --non-interactive || true
docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true

CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || echo 000)"
log "health check http://127.0.0.1:$PORT/ -> $CODE"
case "$CODE" in
    200|301|302|303)
        echo "============================================================"
        echo "  $SLUG updated to $IMAGE (db + moodledata preserved)."
        echo "============================================================"
        ;;
    *)
        echo "!! health check returned $CODE — rolling back to $OLD_IMAGE"
        docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
        if [[ -n "$OLD_IMAGE" ]]; then
            _run_on "$OLD_IMAGE"
            sleep 4
            docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
            echo "!! rolled back to $OLD_IMAGE — the site is live on the previous image."
        else
            echo "!! could not determine the previous image — recreate $CONTAINER manually."
        fi
        exit 1
        ;;
esac
