#!/usr/bin/env bash
# ============================================================================
#  setup-provision.sh — one-time setup of the provisioning endpoint on server B.
#  Installs the provisioning scripts + the Python service + systemd unit +
#  Apache vhost + HTTPS, and starts it. Re-runnable (idempotent): re-run it after
#  pulling new code to redeploy the scripts/service.
#
#  Run with the shared secret and the GitHub token in the environment:
#     export PROVISION_SECRET=$(openssl rand -hex 32); echo "SECRET=$PROVISION_SECRET"
#     export GITHUB_TOKEN=ghp_xxxx
#     sudo -E bash setup-provision.sh
#  (Save the printed SECRET — server A needs the same value.)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SECRET="${PROVISION_SECRET:-}"
TOKEN="${GITHUB_TOKEN:-}"
[[ -n "$SECRET" && -n "$TOKEN" ]] || { echo "Set PROVISION_SECRET and GITHUB_TOKEN first (see header)."; exit 1; }

DOMAIN="academy2026.nitg-eg.com"
SUB="saas-provision.${DOMAIN}"
LE_EMAIL="admin@nitg-eg.com"

mkdir -p /var/www/html/saas/logs

# ── Install the provisioning scripts (single source of truth = this repo) ────
# The service shells out to these by absolute path (see provision.env below).
echo "==> installing provisioning scripts to /root"
cp "$SCRIPT_DIR/create.sh"         /root/create.sh
cp "$SCRIPT_DIR/destroy.sh"        /root/destroy.sh
cp "$SCRIPT_DIR/apply-license.sh"  /root/apply-license.sh
cp "$SCRIPT_DIR/apply-settings.sh" /root/apply-settings.sh
cp "$SCRIPT_DIR/update-site.sh"    /root/update-site.sh
cp "$SCRIPT_DIR/apply-suspend.sh"  /root/apply-suspend.sh
cp "$SCRIPT_DIR/send_welcome.php"  /root/send_welcome.php
cp "$SCRIPT_DIR/apply_hero.php"    /root/apply_hero.php
cp "$SCRIPT_DIR/apply_about.php"   /root/apply_about.php
cp "$SCRIPT_DIR/apply_gallery.php" /root/apply_gallery.php
chmod +x /root/create.sh /root/destroy.sh /root/apply-license.sh /root/apply-settings.sh /root/update-site.sh /root/apply-suspend.sh

# ── The HTTP service — copied verbatim from the repo (NOT inlined), so branding,
#    licence tier, and /apply-license stay in one place: provision-server.py ───
echo "==> writing /var/www/html/saas/provision-server.py"
cp "$SCRIPT_DIR/provision-server.py" /var/www/html/saas/provision-server.py

echo "==> writing /var/www/html/saas/provision.env"
cat > /var/www/html/saas/provision.env <<ENVEOF
PROVISION_SECRET=$SECRET
GITHUB_TOKEN=$TOKEN
SAAS_IMAGE=${SAAS_IMAGE:-ghcr.io/nitgg/saas-moodle:latest}
SAAS_ROOT=${SAAS_ROOT:-/var/www/html/saas}
# Shared SMTP relay used by every academy for outbound mail (welcome email etc).
# Set the real values in this file on server B; they persist across redeploys.
SMTP_HOSTS=${SMTP_HOSTS:-}
SMTP_SECURE=${SMTP_SECURE:-tls}
SMTP_AUTHTYPE=${SMTP_AUTHTYPE:-LOGIN}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_MAXBULK=${SMTP_MAXBULK:-10}
SMTP_NOREPLY=${SMTP_NOREPLY:-}
SMTP_SUPPORTEMAIL=${SMTP_SUPPORTEMAIL:-}
CREATE_SH=/root/create.sh
DESTROY_SH=/root/destroy.sh
APPLY_LICENSE_SH=/root/apply-license.sh
APPLY_SETTINGS_SH=/root/apply-settings.sh
UPDATE_SITE_SH=/root/update-site.sh
APPLY_SUSPEND_SH=/root/apply-suspend.sh
PROVISION_LOG_DIR=/var/www/html/saas/logs
PROVISION_STAGING_DIR=/var/www/html/saas/staging
PROVISION_PORT=9099
ENVEOF
chmod 600 /var/www/html/saas/provision.env

echo "==> installing systemd service"
cat > /etc/systemd/system/saas-provision.service <<'SVCEOF'
[Unit]
Description=SaaS provisioning endpoint
After=network.target docker.service
[Service]
Type=simple
EnvironmentFile=/var/www/html/saas/provision.env
ExecStart=/usr/bin/python3 /var/www/html/saas/provision-server.py
Restart=on-failure
RestartSec=3
User=root
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable saas-provision
systemctl restart saas-provision
sleep 1
systemctl is-active saas-provision && echo "==> service is active"

echo "==> creating Apache vhost for $SUB"
a2enmod proxy proxy_http >/dev/null 2>&1 || true
cat > "/etc/apache2/sites-available/${SUB}.conf" <<APACHEEOF
<VirtualHost *:80>
    ServerName $SUB
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:9099/
    ProxyPassReverse / http://127.0.0.1:9099/
</VirtualHost>
APACHEEOF
a2ensite "${SUB}.conf" >/dev/null
apache2ctl configtest && systemctl reload apache2

echo "==> requesting HTTPS certificate for $SUB"
certbot --apache -d "$SUB" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect \
    || echo "!! certbot failed — check that $SUB resolves (wildcard DNS) and port 80 is open."
systemctl reload apache2

echo ""
echo "============================================================"
echo "  Provisioning endpoint ready:"
echo "    https://$SUB/provision"
echo "  On server A (nit2 .env) set:"
echo "    PROVISION_URL=https://$SUB/provision"
echo "    PROVISION_SECRET=$SECRET"
echo "============================================================"
