#!/usr/bin/env bash
# ============================================================================
#  update-site.sh — refresh a live academy by recreating it from a new BAKED IMAGE tag.
#
#  There is no per-client git repo to pull.
#  Updating = recreate the client's container from a NEW baked image tag, then
#  run the pending upgrade + purge. moodledata + the database persist across the
#  recreate (they are separate volumes), so no data is lost. Rollback = re-run
#  with SAAS_IMAGE pointing at the previous tag.
#
#  Usage:   SAAS_IMAGE=saas-moodle:2026.09 bash update-site.sh <slug>
#
#  Env:
#    SAAS_IMAGE   new baked image to recreate from (default: saas-moodle:latest)
#    LICENSE_TIER / LICENSE_DEFINITION   re-applied if provided (as in update-site.sh)
#
#  CUSTOM_CODE clients (code bind-mounted) are updated the old way: git pull
#  inside the container — detected automatically from the container's mounts.
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

ROOT="/opt/saas"
NET="saas_net"
IMAGE="${SAAS_IMAGE:-saas-moodle:latest}"

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash update-site.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
CLIENT_DIR="$ROOT/clients/$SLUG"
CODE_DIR="$CLIENT_DIR/code"
DATA_DIR="$CLIENT_DIR/moodledata"
CONF="$CLIENT_DIR/config.php"

docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

# ── CUSTOM_CODE client? (code bind-mounted at /var/www/html) → old git-pull path
if docker inspect -f '{{range .Mounts}}{{println .Destination}}{{end}}' "$CONTAINER" 2>/dev/null | grep -qx "/var/www/html"; then
    log "custom-code client — pulling its branch inside the container"
    docker exec "$CONTAINER" git -C /var/www/html pull --ff-only || die "git pull failed (branch may have diverged)"
else
    # ── Baked-image client → recreate from the new image tag ────────────────
    docker image inspect "$IMAGE" >/dev/null 2>&1 \
        || die "image '$IMAGE' not found — build/pull it first (docker/build-image.sh)"

    PORT="$(docker inspect -f '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' "$CONTAINER" 2>/dev/null || true)"
    [[ -n "$PORT" ]] || die "could not determine host port for $CONTAINER"
    [[ -f "$CONF" ]] || die "per-client config missing: $CONF"

    log "recreating $CONTAINER from $IMAGE on 127.0.0.1:$PORT"
    docker rm -f "$CONTAINER" >/dev/null
    docker run -d --name "$CONTAINER" --network "$NET" --restart unless-stopped \
        -v "$CONF":/var/www/html/config.php:ro \
        -v "$DATA_DIR":/var/www/moodledata \
        -p "127.0.0.1:$PORT:80" \
        "$IMAGE"
    sleep 5
fi

log "running upgrade (picks up any new plugin versions)"
docker exec "$CONTAINER" php /var/www/html/admin/cli/upgrade.php --non-interactive || echo "!! upgrade step reported an issue (site still up)"

if [[ -n "${LICENSE_TIER:-}" ]]; then
    log "re-applying licence tier=$LICENSE_TIER (enforcement on)"
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=tier       --set="$LICENSE_TIER" || echo "!! could not set licence tier"
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=enabled    --set=1               || echo "!! could not enable enforcement"
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component=local_license --name=definition --set="${LICENSE_DEFINITION:-}" || echo "!! could not set licence definition"
fi

docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php || true
log "done"
