#!/usr/bin/env bash
# ============================================================================
#  bump-image.sh — point provisioning at a baked-image tag and (optionally) roll
#  every live academy onto it. Run ON THE ACADEMY SERVER (where provision.env is).
#
#  Usage:
#    bash bump-image.sh                 # -> :latest, pull + restart the service
#    bash bump-image.sh 2026.08.12      # -> pin that exact version tag
#    bash bump-image.sh --all           # -> :latest, then recreate EVERY academy
#    bash bump-image.sh 2026.08.12 --all
#
#  What it does:
#    1. docker pull the target image (fails early if it can't — bad tag / GHCR login)
#    2. rewrite SAAS_IMAGE in provision.env
#    3. systemctl restart saas-provision  (so the running service reads the new tag)
#    4. with --all: run update-image.sh for each saas_moodle_* container
#
#  New academies pick up the tag automatically; existing ones update on the next
#  "⟳ Update" from the dashboard, or immediately with --all here.
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

REPO="${SAAS_IMAGE_REPO:-ghcr.io/nitgg/saas-moodle}"
ROOT="${SAAS_ROOT:-/var/www/html/saas}"
ENV_FILE="${PROVISION_ENV:-$ROOT/provision.env}"
SERVICE="${PROVISION_SERVICE:-saas-provision}"
UPDATE_IMAGE_SH="${UPDATE_IMAGE_SH:-/root/update-image.sh}"

# ── Parse args: an optional tag (positional) + an optional --all flag ─────────
TAG="latest"; DOALL=0
for a in "$@"; do
    case "$a" in
        --all) DOALL=1 ;;
        -*)    die "unknown flag '$a' (use: bump-image.sh [tag] [--all])" ;;
        *)     TAG="$a" ;;
    esac
done
IMAGE="$REPO:$TAG"

[[ -f "$ENV_FILE" ]] || die "provision.env not found at $ENV_FILE (set PROVISION_ENV / SAAS_ROOT)"

# ── 1. Pull first — never point provisioning at an image that isn't there ─────
log "pulling $IMAGE"
docker pull "$IMAGE" || die "could not pull $IMAGE — check the tag and 'docker login ghcr.io'"

# ── 2. Rewrite SAAS_IMAGE in provision.env (add the line if it's missing) ─────
if grep -q '^SAAS_IMAGE=' "$ENV_FILE"; then
    sed -i "s|^SAAS_IMAGE=.*|SAAS_IMAGE=$IMAGE|" "$ENV_FILE"
else
    echo "SAAS_IMAGE=$IMAGE" >> "$ENV_FILE"
fi
log "provision.env now has: $(grep '^SAAS_IMAGE=' "$ENV_FILE")"

# ── 3. Recreate every academy onto the new image FIRST (when --all) ──────────
# CRITICAL ORDERING: this must happen BEFORE the service restart. bump-image.sh
# is launched by provision-server.py inside the saas-provision systemd cgroup;
# `systemctl restart saas-provision` tears down that whole cgroup (KillMode=
# control-group), which kills THIS script mid-run — start_new_session does NOT
# escape the cgroup. Previously the restart ran first, so the --all loop below
# never got to run and no academy was ever updated (the GitHub job still saw the
# request accepted). Each update-image.sh gets SAAS_IMAGE explicitly, so it does
# not need the service restarted first. The restart happens LAST (step 4); if it
# kills us at that point, the academies are already done.
if [[ "$DOALL" == "1" ]]; then
    [[ -f "$UPDATE_IMAGE_SH" ]] || die "$UPDATE_IMAGE_SH not found — deploy provisioning scripts first"
    mapfile -t CONTAINERS < <(docker ps --format '{{.Names}}' | grep '^saas_moodle_' || true)
    if [[ ${#CONTAINERS[@]} -eq 0 ]]; then
        log "no running saas_moodle_* academies to update"
    else
        log "recreating ${#CONTAINERS[@]} academy container(s) onto $IMAGE"
        ok=0; fail=0
        for c in "${CONTAINERS[@]}"; do
            slug="${c#saas_moodle_}"
            log "── updating $slug ──"
            if SAAS_IMAGE="$IMAGE" SAAS_ROOT="$ROOT" bash "$UPDATE_IMAGE_SH" "$slug"; then
                ok=$((ok + 1))
            else
                fail=$((fail + 1)); echo "!! $slug failed to update"
            fi
        done
        log "done: $ok updated, $fail failed"

        # Reclaim disk: every rollout pulls a new saas-moodle tag, and the old tags
        # pile up until the disk fills (errno=28 "No space left on device" takes the
        # academies down). Remove old tags of THIS repo that no running container
        # uses — `docker rmi` safely refuses any image still in use, and we always
        # keep the current tag + :latest. Then drop dangling layers + build cache.
        log "pruning old $REPO images (keeping :$TAG and :latest)"
        docker image ls "$REPO" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null \
            | grep -v -e ":$TAG\$" -e ":latest\$" -e ":<none>\$" \
            | while read -r _old; do
                docker rmi "$_old" >/dev/null 2>&1 && echo "   removed $_old" || true
              done
        docker image prune -f >/dev/null 2>&1 || true
        docker builder prune -f >/dev/null 2>&1 || true
        log "disk after prune: $(df -h / | awk 'NR==2{print $4" free ("$5" used)"}')"

        # Completion ping — server-side truth that every container was recreated
        # (the GitHub job only knows the request was accepted). Best-effort; needs
        # TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in the environment (provision.env).
        if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
            if [[ "$fail" -eq 0 ]]; then
                TG_MSG="✅ SaaS rollout complete — ${ok} academy(ies) now on ${IMAGE}."
            else
                TG_MSG="⚠️ SaaS rollout finished with errors — ${ok} updated, ${fail} FAILED on ${IMAGE}. Check bump-image.log."
            fi
            curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
                --data-urlencode chat_id="${TELEGRAM_CHAT_ID}" \
                --data-urlencode text="${TG_MSG}" >/dev/null 2>&1 \
                || echo "!! telegram completion ping failed"
        fi
    fi
fi

# ── 4. Restart the provisioning service LAST so it reads the new tag. This is
# the step that (by design) tears down our own cgroup — so nothing important may
# come after it. New academies then provision on the new SAAS_IMAGE.
log "restarting $SERVICE"
systemctl restart "$SERVICE" || die "failed to restart $SERVICE"

echo "============================================================"
echo "  SAAS_IMAGE = $IMAGE  (service restarted)"
[[ "$DOALL" == "1" ]] && echo "  all academies recreated onto it" \
                      || echo "  new academies use it now; existing ones update on next ⟳ Update (or re-run with --all)"
echo "============================================================"
