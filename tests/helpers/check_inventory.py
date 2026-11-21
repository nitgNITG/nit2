"""Checks for GET /inventory on both provisioners (collect_inventory): the docker /
mariadb / certbot calls are replaced by canned output in their real formats, the
vhost and client files are real temp files. Run by tests/orphan-check.test.ts.

Usage: python check_inventory.py <provisioning/provision-server.py> <provisioning-store/provision-server.py>
"""
import importlib.util, json, os, sys, tempfile

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    fails += not ok
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"\n   got:  {got!r}\n   want: {want!r}"))


def load(path, name, env):
    os.environ.update(env)
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def write(path, text=""):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)


CERTS_OUT = """Found the following certs:
  Certificate Name: acme.academy2026.nitg-eg.com
    Domains: acme.academy2026.nitg-eg.com
  Certificate Name: learn.acme.com
    Domains: learn.acme.com
"""

# ── Academy server ────────────────────────────────────────────────────────────
tmp = tempfile.mkdtemp()
sites = os.path.join(tmp, "sites")
write(os.path.join(sites, "acme.academy2026.nitg-eg.com.conf"),
      "<VirtualHost *:80>\n    ServerName acme.academy2026.nitg-eg.com\n    ProxyPass / http://127.0.0.1:8101/\n</VirtualHost>\n")
write(os.path.join(sites, "learn.acme.com-le-ssl.conf"),
      "<VirtualHost *:443>\n    ServerName learn.acme.com\n    ServerAlias www.learn.acme.com\n    ProxyPass / http://127.0.0.1:8101/\n</VirtualHost>\n")
write(os.path.join(sites, "000-default.conf"), "<VirtualHost *:80>\n    DocumentRoot /var/www/html\n</VirtualHost>\n")
os.makedirs(os.path.join(tmp, "clients", "acme"))
os.makedirs(os.path.join(tmp, "clients", "half-made"))
os.makedirs(os.path.join(tmp, "clients", "not a slug"))
write(os.path.join(tmp, "saas.env"), "DB_ROOT_PW='rootpw'\n")

a = load(sys.argv[1], "academy_ps", {"PROVISION_SECRET": "s", "PROVISION_LOG_DIR": tmp, "PROVISION_STAGING_DIR": tmp,
                                     "SAAS_ROOT": tmp, "APACHE_SITES_DIR": sites})
a.APACHE_SITES_DIR = sites
calls = []


def fake_sh_academy(argv, timeout=60):
    calls.append(argv)
    if argv[:2] == ["docker", "ps"]:
        return 0, "saas_moodle_acme\trunning\nsaas_moodle_old\texited\nsaas_moodle_Bad_Name\trunning\n"
    if argv[:2] == ["docker", "inspect"]:
        return 0, ('/saas_moodle_acme|{"80/tcp":[{"HostIp":"127.0.0.1","HostPort":"8101"}]}\n'
                   '/saas_moodle_old|{"80/tcp":[{"HostIp":"127.0.0.1","HostPort":"8102"}]}\n')
    if argv[:2] == ["docker", "exec"]:
        return 0, "moodle_acme\nmoodle_old_school\n"
    if argv[0] == "certbot":
        return 0, CERTS_OUT
    return 1, ""


a._sh = fake_sh_academy
inv = a.collect_inventory()
check("academy: containers (bad names skipped)", inv["containers"],
      [{"slug": "acme", "state": "running"}, {"slug": "old", "state": "exited"}])
check("academy: ports of stopped containers too", inv["ports"], {"acme": [8101], "old": [8102]})
check("academy: client dirs (only valid slugs)", inv["dirs"], ["acme", "half-made"])
check("academy: databases, _ back to -", inv["databases"], ["acme", "old-school"])
check("academy: DB root password read from saas.env", any("-prootpw" in c for c in calls), True)
check("academy: vhosts with names (+ aliases) and ports; non-proxy sites skipped", inv["vhosts"], [
    {"file": os.path.join(sites, "acme.academy2026.nitg-eg.com.conf"), "names": ["acme.academy2026.nitg-eg.com"], "ports": [8101]},
    {"file": os.path.join(sites, "learn.acme.com-le-ssl.conf"), "names": ["learn.acme.com", "www.learn.acme.com"], "ports": [8101]},
])
check("academy: certs", inv["certs"], ["acme.academy2026.nitg-eg.com", "learn.acme.com"])
check("academy: no errors", inv["errors"], [])
check("academy: JSON-serialisable", bool(json.dumps(inv)), True)

a._sh = lambda argv, timeout=60: (1, "")
broken = a.collect_inventory()
check("academy: unreadable pieces are null + noted", (broken["databases"], broken["certs"], len(broken["errors"])), (None, None, 3))

# ── Store server ──────────────────────────────────────────────────────────────
st = tempfile.mkdtemp()
write(os.path.join(st, "clients", "shop", "store.env"), "P_SITE=9100\nP_DASH='9101'\nP_API=9102\nIMAGE_TAG=1.0.0\n")
os.makedirs(os.path.join(st, "clients", "empty"))
nginx = os.path.join(st, "nginx")
write(os.path.join(nginx, "saas-store-shop.commerce.nitg-eg.com.conf"),
      "server {\n    server_name shop.commerce.nitg-eg.com;\n    location / { proxy_pass http://127.0.0.1:9100; }\n"
      "    location /api/ { proxy_pass http://127.0.0.1:9102; }\n}\n")
write(os.path.join(nginx, "other.conf"), "server { server_name x; proxy_pass http://127.0.0.1:3000; }\n")  # not saas-store-*
s = load(sys.argv[2], "store_ps", {"PROVISION_SECRET": "s", "STORE_ROOT": st, "PROVISION_LOG_DIR": st,
                                   "APACHE_SITES_DIR": os.path.join(st, "no-apache"), "NGINX_CONF_DIR": nginx,
                                   "DB_ROOT_PW": "pw", "STORE_DOMAIN": "commerce.nitg-eg.com"})
s.NGINX_CONF_DIR, s.APACHE_SITES_DIR = nginx, os.path.join(st, "no-apache")


def fake_sh_store(argv, timeout=60):
    if argv[:2] == ["docker", "ps"]:
        return 0, "store_shop\trunning\nstore_shop\texited\nstore_old_shop\texited\nsaas_moodle_acme\trunning\nsome_other\trunning\n"
    if argv[:2] == ["docker", "exec"]:
        return 0, "store_shop\nstore_old_shop\n"
    if argv[0] == "certbot":
        return 0, "  Certificate Name: shop.commerce.nitg-eg.com\n"
    return 1, ""


s._sh = fake_sh_store
s._cloudinary_store_folders = lambda: ["old-shop", "shop"]
si = s.collect_inventory()
check("store: compose projects → slugs, running wins", si["containers"],
      [{"slug": "old-shop", "state": "exited"}, {"slug": "shop", "state": "running"}])
check("store: ports from store.env", si["ports"], {"shop": [9100, 9101, 9102]})
check("store: client dirs", si["dirs"], ["empty", "shop"])
check("store: databases", si["databases"], ["old-shop", "shop"])
check("store: Cloudinary folders", si["media"], ["old-shop", "shop"])
check("store: only saas-store-* nginx files", [v["file"] for v in si["vhosts"]], [os.path.join(nginx, "saas-store-shop.commerce.nitg-eg.com.conf")])
check("store: nginx server_name + both ports", (si["vhosts"][0]["names"], si["vhosts"][0]["ports"]), (["shop.commerce.nitg-eg.com"], [9100, 9102]))
check("store: store_ports ignores junk", s.store_ports("P_SITE=abc\nP_API=9102\nX=1"), [9102])

# ── Cloudinary folder listing against a local fake of the Admin API ───────────
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

seen = []
mode = {"value": "ok"}


class FakeCloudinary(BaseHTTPRequestHandler):
    def do_GET(self):
        seen.append((self.path, self.headers.get("Authorization")))
        if mode["value"] == "missing":
            self.send_response(404); self.end_headers(); self.wfile.write(b"{}"); return
        if mode["value"] == "down":
            self.send_response(500); self.end_headers(); self.wfile.write(b"{}"); return
        page2 = "next_cursor=c2" in self.path
        body = {"folders": [{"name": "shop", "path": "stores/shop"}, {"name": "Not_A_Slug", "path": "stores/Not_A_Slug"}],
                "next_cursor": "c2"} if not page2 else {"folders": [{"name": "old-shop", "path": "stores/old-shop"}]}
        data = json.dumps(body).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(data)

    def log_message(self, *a):
        pass


srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeCloudinary)
threading.Thread(target=srv.serve_forever, daemon=True).start()
os.environ.update(CLOUDINARY_CLOUD_NAME="demo", CLOUDINARY_API_KEY="k", CLOUDINARY_API_SECRET="sec",
                  CLOUDINARY_API_BASE=f"http://127.0.0.1:{srv.server_address[1]}")
s2 = load(sys.argv[2], "store_ps2", {})
check("cloudinary: every page, valid slugs only, sorted", s2._cloudinary_store_folders(), ["old-shop", "shop"])
check("cloudinary: Admin API path + basic auth", (seen[0][0].split("?")[0], seen[0][1]),
      ("/v1_1/demo/folders/stores", "Basic " + __import__("base64").b64encode(b"k:sec").decode()))
mode["value"] = "missing"
check("cloudinary: no stores/ folder yet → empty", s2._cloudinary_store_folders(), [])
mode["value"] = "down"
check("cloudinary: an error → None (reported, not 'no media')", s2._cloudinary_store_folders(), None)
for k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
    os.environ.pop(k)
check("cloudinary: not configured → None", s2._cloudinary_store_folders(), None)
srv.shutdown()

print("ALL PASS" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
