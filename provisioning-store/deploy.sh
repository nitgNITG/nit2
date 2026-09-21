#!/usr/bin/env bash
# ============================================================================
#  deploy.sh — ship this folder to the host that runs the store provisioner and
#  (re)run setup.sh there. Mirror of provisioning/deploy-provisioning.sh.
#
#    bash provisioning-store/deploy.sh --local          # provisioner on THIS box (nit2's server)
#    bash provisioning-store/deploy.sh                  # remote: STORE_HOST / STORE_SSH_USER / STORE_SSH_KEY / STORE_DEST from ../.env
#
#  Secrets are never sent: setup.sh on the target reuses what is already in its
#  provision.env. Edit that file on the host for MAIL_* / CLOUDINARY_* / GHCR_*.
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../.env}"

if [[ "${1:-}" == "--local" ]]; then
    echo "==> running setup.sh locally"
    sudo -E bash "$HERE/setup.sh"
    exit 0
fi

if [[ -f "$ENV_FILE" ]]; then
    set -a; source <(grep -E '^STORE_(HOST|SSH_USER|SSH_KEY|DEST)=' "$ENV_FILE" || true); set +a
fi
HOST="${STORE_HOST:-}"
USER_="${STORE_SSH_USER:-deploy}"
DEST="${STORE_DEST:-/tmp/nit-provisioning-store}"
KEY="${STORE_SSH_KEY:-}"
[[ -n "$HOST" ]] || { echo "STORE_HOST is not set (add STORE_HOST / STORE_SSH_USER / STORE_SSH_KEY to $ENV_FILE), or use --local"; exit 1; }

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
TARGET="${USER_}@${HOST}"

echo "==> [1/3] preparing $DEST on $TARGET"
ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$DEST/proxy'"
echo "==> [2/3] copying provisioning-store/"
if command -v rsync >/dev/null 2>&1; then
    rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$HERE/" "$TARGET:$DEST/"
else
    scp -r "${SSH_OPTS[@]}" "$HERE"/* "$TARGET:$DEST/"
fi
echo "==> [3/3] running setup.sh on $TARGET"
ssh -t "${SSH_OPTS[@]}" "$TARGET" "cd '$DEST' && sudo -E bash setup.sh && systemctl is-active saas-store-provision"
echo "==> done"
