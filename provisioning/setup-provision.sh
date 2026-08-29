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
cp "$SCRIPT_DIR/apply_contact.php"  /root/apply_contact.php
cp "$SCRIPT_DIR/apply_login.php"    /root/apply_login.php
cp "$SCRIPT_DIR/apply_google_login.php" /root/apply_google_login.php
cp "$SCRIPT_DIR/apply_footer.php"   /root/apply_footer.php
cp "$SCRIPT_DIR/apply_apptoken.php" /root/apply_apptoken.php
cp "$SCRIPT_DIR/apply-branding.sh"  /root/apply-branding.sh
cp "$SCRIPT_DIR/update-image.sh"    /root/update-image.sh
cp "$SCRIPT_DIR/bump-image.sh"      /root/bump-image.sh
cp "$SCRIPT_DIR/saas-cron.sh"       /root/saas-cron.sh
chmod +x /root/create.sh /root/destroy.sh /root/apply-license.sh /root/apply-settings.sh /root/update-site.sh /root/apply-suspend.sh /root/apply-branding.sh /root/update-image.sh /root/bump-image.sh /root/saas-cron.sh

# ── The HTTP service — copied verbatim from the repo (NOT inlined), so branding,
#    licence tier, and /apply-license stay in one place: provision-server.py ───
echo "==> writing /var/www/html/saas/provision-server.py"
cp "$SCRIPT_DIR/provision-server.py" /var/www/html/saas/provision-server.py

# ── Preserve operator-set values across redeploys ───────────────────────────
# This script REWRITES provision.env, so without this a redeploy would reset the
# image tag back to :latest and blank the SMTP relay. Precedence for each value:
#   1) a var already exported in this shell   (explicit override)
#   2) the value already in provision.env      (what the operator set last time)
#   3) the default in the heredoc below.
_ENVF=/var/www/html/saas/provision.env
_keep(){ [[ -f "$_ENVF" ]] && sed -n "s/^$1=//p" "$_ENVF" | tail -1 || true; }
SAAS_IMAGE="${SAAS_IMAGE:-$(_keep SAAS_IMAGE)}"
SAAS_ROOT="${SAAS_ROOT:-$(_keep SAAS_ROOT)}"
SMTP_HOSTS="${SMTP_HOSTS:-$(_keep SMTP_HOSTS)}"
SMTP_SECURE="${SMTP_SECURE:-$(_keep SMTP_SECURE)}"
SMTP_AUTHTYPE="${SMTP_AUTHTYPE:-$(_keep SMTP_AUTHTYPE)}"
SMTP_USER="${SMTP_USER:-$(_keep SMTP_USER)}"
SMTP_PASS="${SMTP_PASS:-$(_keep SMTP_PASS)}"
SMTP_MAXBULK="${SMTP_MAXBULK:-$(_keep SMTP_MAXBULK)}"
SMTP_NOREPLY="${SMTP_NOREPLY:-$(_keep SMTP_NOREPLY)}"
SMTP_SUPPORTEMAIL="${SMTP_SUPPORTEMAIL:-$(_keep SMTP_SUPPORTEMAIL)}"

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

# ── Moodle cron for every academy (a oneshot service driven by a 1-min timer) ─
# Without this, no academy runs scheduled tasks: queued email/notifications,
# backups, cleanup and enrolment expiry never fire.
echo "==> installing saas-cron timer (runs Moodle cron in every academy each minute)"
cat > /etc/systemd/system/saas-cron.service <<'CRONEOF'
[Unit]
Description=Run Moodle cron in every academy container
After=docker.service
[Service]
Type=oneshot
ExecStart=/root/saas-cron.sh
User=root
CRONEOF
cat > /etc/systemd/system/saas-cron.timer <<'CRONTEOF'
[Unit]
Description=Drive Moodle cron for all academies every minute
[Timer]
OnCalendar=*-*-* *:*:00
AccuracySec=10s
Persistent=false
[Install]
WantedBy=timers.target
CRONTEOF
systemctl daemon-reload
systemctl enable --now saas-cron.timer
systemctl is-active saas-cron.timer && echo "==> saas-cron.timer is active"

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
