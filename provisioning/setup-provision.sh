#!/usr/bin/env bash
# ============================================================================
#  setup-provision.sh — one-time setup of the provisioning endpoint on server B.
#  Writes the Python service + systemd unit + Apache vhost + HTTPS, and starts it.
#
#  Run with the shared secret and the GitHub token in the environment:
#     export PROVISION_SECRET=$(openssl rand -hex 32); echo "SECRET=$PROVISION_SECRET"
#     export GITHUB_TOKEN=ghp_xxxx
#     sudo -E bash setup-provision.sh
#  (Save the printed SECRET — server A needs the same value.)
# ============================================================================
set -euo pipefail

SECRET="${PROVISION_SECRET:-}"
TOKEN="${GITHUB_TOKEN:-}"
[[ -n "$SECRET" && -n "$TOKEN" ]] || { echo "Set PROVISION_SECRET and GITHUB_TOKEN first (see header)."; exit 1; }

DOMAIN="academy2026.nitg-eg.com"
SUB="saas-provision.${DOMAIN}"
LE_EMAIL="admin@nitg-eg.com"

mkdir -p /opt/saas/logs

echo "==> writing /opt/saas/provision-server.py"
cat > /opt/saas/provision-server.py <<'PYEOF'
#!/usr/bin/env python3
import os, re, json, hmac, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET    = os.environ.get("PROVISION_SECRET", "")
CREATE_SH = os.environ.get("CREATE_SH", "/root/create.sh")
LOG_DIR   = os.environ.get("PROVISION_LOG_DIR", "/opt/saas/logs")
PORT      = int(os.environ.get("PROVISION_PORT", "9099"))
SLUG_RE   = re.compile(r"^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$")
os.makedirs(LOG_DIR, exist_ok=True)

def run_create(slug, name):
    logpath = os.path.join(LOG_DIR, f"{slug}.log")
    with open(logpath, "ab", buffering=0) as log:
        log.write(f"\n===== provisioning {slug} =====\n".encode())
        subprocess.run(["bash", CREATE_SH, slug, name], stdout=log,
                       stderr=subprocess.STDOUT, env={**os.environ})

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def _authed(self):
        return bool(SECRET) and hmac.compare_digest(self.headers.get("X-Provision-Secret",""), SECRET)
    def do_POST(self):
        if self.path != "/provision": return self._send(404, {"error":"not found"})
        if not self._authed(): return self._send(401, {"error":"unauthorized"})
        try:
            n = int(self.headers.get("Content-Length","0"))
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._send(400, {"error":"bad json"})
        slug = str(data.get("slug","")).strip().lower()
        name = str(data.get("name","")).strip()
        if not SLUG_RE.match(slug): return self._send(400, {"error":"invalid slug"})
        if not name: return self._send(400, {"error":"name required"})
        threading.Thread(target=run_create, args=(slug, name), daemon=True).start()
        return self._send(202, {"ok":True,"status":"provisioning","slug":slug})
    def do_GET(self):
        if not self.path.startswith("/status/"): return self._send(404, {"error":"not found"})
        if not self._authed(): return self._send(401, {"error":"unauthorized"})
        slug = self.path[len("/status/"):]
        if not SLUG_RE.match(slug): return self._send(400, {"error":"invalid slug"})
        logpath = os.path.join(LOG_DIR, f"{slug}.log")
        if not os.path.exists(logpath): return self._send(404, {"error":"no log yet"})
        with open(logpath, "r", errors="replace") as f: tail = f.read()[-4000:]
        return self._send(200, {"slug":slug, "done":"is live:" in tail, "log":tail})
    def log_message(self, *a): pass

if __name__ == "__main__":
    if not SECRET: raise SystemExit("PROVISION_SECRET not set")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
PYEOF

echo "==> writing /opt/saas/provision.env"
cat > /opt/saas/provision.env <<ENVEOF
PROVISION_SECRET=$SECRET
GITHUB_TOKEN=$TOKEN
CREATE_SH=/root/create.sh
PROVISION_LOG_DIR=/opt/saas/logs
PROVISION_PORT=9099
ENVEOF
chmod 600 /opt/saas/provision.env

echo "==> installing systemd service"
cat > /etc/systemd/system/saas-provision.service <<'SVCEOF'
[Unit]
Description=SaaS provisioning endpoint
After=network.target docker.service
[Service]
Type=simple
EnvironmentFile=/opt/saas/provision.env
ExecStart=/usr/bin/python3 /opt/saas/provision-server.py
Restart=on-failure
RestartSec=3
User=root
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable --now saas-provision
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
