#!/usr/bin/env bash
# ============================================================================
#  deploy-provisioning.sh — push the provisioning scripts from server A (this app
#  server, which has the repo) to server B (the provisioning box) and redeploy the
#  service there.
#
#  CRITICAL VALUES STAY IN THE APP'S .env — this script hardcodes nothing.
#  Add to server A's .env (same file the app uses):
#     SERVER_B_HOST=1.2.3.4                       # required — server B ip/hostname
#     SERVER_B_USER=deploy                        # optional (default: deploy)
#     SERVER_B_SSH_KEY=/home/deploy/.ssh/id_ed25519   # optional — ssh private key
#     SERVER_B_DEST=/tmp/nit-provisioning         # optional — staging dir on B
#
#  Secrets are NEVER sent over the wire: setup-provision.sh on server B reuses the
#  PROVISION_SECRET / GITHUB_TOKEN already in its own /var/www/html/saas/provision.env.
#
#  Usage (on server A):   bash provisioning/deploy-provisioning.sh
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # .../provisioning
ENV_FILE="${ENV_FILE:-$HERE/../.env}"                  # the app's .env on server A

# Pull ONLY the SERVER_B_* keys out of the app .env (ignore everything else).
if [[ -f "$ENV_FILE" ]]; then
    set -a; source <(grep -E '^SERVER_B_[A-Z_]+=' "$ENV_FILE" || true); set +a
fi

HOST="${SERVER_B_HOST:-}"
USER_B="${SERVER_B_USER:-deploy}"
DEST="${SERVER_B_DEST:-/tmp/nit-provisioning}"
KEY="${SERVER_B_SSH_KEY:-}"

[[ -n "$HOST" ]] || {
    echo "SERVER_B_HOST is not set. Add SERVER_B_HOST (+ SERVER_B_USER / SERVER_B_SSH_KEY)"
    echo "to $ENV_FILE — see this script's header."
    exit 1
}

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
TARGET="${USER_B}@${HOST}"
FILES=(create.sh destroy.sh cleanup-orphans.sh apply-license.sh apply-settings.sh update-site.sh apply-suspend.sh apply-branding.sh update-image.sh bump-image.sh saas-cron.sh saas-quota.sh reset-welcome.sh apply-integrations.sh send-expiry-reminder.sh send_welcome.php cleanup_external_media.php ensure_owner_role.php enable_payment_provider.php send_expiry_reminder.php apply_hero.php apply_about.php apply_gallery.php apply_contact.php apply_login.php apply_google_login.php apply_footer.php apply_apptoken.php provision-server.py setup-provision.sh)

echo "==> [1/3] ensuring ${DEST} exists on ${TARGET}"
ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$DEST'"

echo "==> [2/3] copying provisioning scripts"
if command -v rsync >/dev/null 2>&1; then
    (cd "$HERE" && rsync -az -e "ssh ${SSH_OPTS[*]}" "${FILES[@]}" "${TARGET}:${DEST}/")
else
    (cd "$HERE" && scp "${SSH_OPTS[@]}" "${FILES[@]}" "${TARGET}:${DEST}/")
fi

echo "==> [3/3] redeploying provisioning service on ${TARGET} (reusing its own secret/token)"
# One sudo shell on B: source the existing provision.env (as root) so setup-provision.sh
# has PROVISION_SECRET + GITHUB_TOKEN, then run it. -t gives sudo a TTY if it prompts.
ssh -t "${SSH_OPTS[@]}" "$TARGET" \
    "cd '$DEST' && sudo bash -c 'set -a; source /var/www/html/saas/provision.env; set +a; bash setup-provision.sh' && systemctl is-active saas-provision"

echo "==> done — provisioning service updated on ${HOST}"
