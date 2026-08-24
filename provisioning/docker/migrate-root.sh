#!/usr/bin/env bash
# ============================================================================
#  migrate-root.sh — ONE-TIME: move the academies data dir and reattach every
#  academy container to the new path. Data (DB + moodledata) is preserved.
#
#  Run on Server B as root:
#     bash migrate-root.sh
#  Then, on Server A, redeploy so the systemd service points at the new path:
#     git pull && bash provisioning/deploy-provisioning.sh
#
#  Env (defaults shown):
#     OLD_ROOT=/opt/saas   NEW_ROOT=/var/www/html/saas   NET=saas_net
#     SAAS_IMAGE=ghcr.io/nitgg/saas-moodle:latest   (image to recreate from)
#
#  Assumes baked-image academies (config.php + moodledata mounts). A CUSTOM_CODE
#  client (code bind-mounted) would need its code mount re-added by hand.
# ============================================================================
set -euo pipefail

OLD_ROOT="${OLD_ROOT:-/opt/saas}"
NEW_ROOT="${NEW_ROOT:-/var/www/html/saas}"
NET="${NET:-saas_net}"
IMAGE="${SAAS_IMAGE:-ghcr.io/nitgg/saas-moodle:latest}"

log(){ echo "==> $*"; }

[[ -d "$OLD_ROOT" ]] || { echo "nothing to move: $OLD_ROOT not found"; exit 1; }
[[ -e "$NEW_ROOT" ]] && { echo "refusing: $NEW_ROOT already exists"; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "image $IMAGE not found — pull it first"; exit 1; }

# 1. Record each academy container + its host port (before we remove them).
mapfile -t NAMES < <(docker ps -a --format '{{.Names}}' | grep '^saas_moodle_' || true)
declare -A PORTS
for name in "${NAMES[@]}"; do
    PORTS[$name]="$(docker inspect -f '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' "$name" 2>/dev/null || true)"
    log "found $name (port ${PORTS[$name]:-?})"
done

# 2. Stop the provisioner (its unit still points at OLD_ROOT — redeployed after).
systemctl stop saas-provision 2>/dev/null || true

# 3. Remove the academy containers (their data lives on disk, not in them).
for name in "${NAMES[@]}"; do docker rm -f "$name" >/dev/null && log "removed $name"; done

# 4. Move the data dir.
mkdir -p "$(dirname "$NEW_ROOT")"
mv "$OLD_ROOT" "$NEW_ROOT"
log "moved $OLD_ROOT -> $NEW_ROOT"

# 5. Recreate each academy from the NEW paths, same port, baked image.
for name in "${NAMES[@]}"; do
    slug="${name#saas_moodle_}"; port="${PORTS[$name]}"
    conf="$NEW_ROOT/clients/$slug/config.php"
    data="$NEW_ROOT/clients/$slug/moodledata"
    if [[ ! -f "$conf" || -z "$port" ]]; then echo "!! skipping $slug (missing config.php or port)"; continue; fi
    docker run -d --name "$name" --network "$NET" --restart unless-stopped \
        -v "$conf":/var/www/html/config.php:ro \
        -v "$data":/var/www/moodledata \
        -p "127.0.0.1:$port:80" "$IMAGE" >/dev/null
    log "recreated $name on 127.0.0.1:$port"
done

echo ""
echo "============================================================"
echo "  Data dir moved to $NEW_ROOT and academies reattached."
echo "  NEXT (Server A):  git pull && bash provisioning/deploy-provisioning.sh"
echo "  (rewrites the systemd service + provision.env to $NEW_ROOT)"
echo "============================================================"
