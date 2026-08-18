#!/usr/bin/env python3
"""
Minimal provisioning endpoint for server B.

  POST /provision   body {"slug","name"}   header  X-Provision-Secret: <secret>
    → runs create.sh <slug> "<name>" in the BACKGROUND, logs to
      /opt/saas/logs/<slug>.log, returns 202 immediately.
  GET  /status/<slug>   header X-Provision-Secret
    → returns the tail of that client's provisioning log.

Security: shared-secret auth, strict slug validation, args passed as a list
(never a shell string), bound to 127.0.0.1 (reached only via the Apache vhost).
No third-party dependencies — Python 3 stdlib only.
"""
import os, re, json, hmac, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET    = os.environ.get("PROVISION_SECRET", "")
CREATE_SH = os.environ.get("CREATE_SH", "/root/create.sh")
LOG_DIR   = os.environ.get("PROVISION_LOG_DIR", "/opt/saas/logs")
PORT      = int(os.environ.get("PROVISION_PORT", "9099"))
SLUG_RE   = re.compile(r"^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$")

os.makedirs(LOG_DIR, exist_ok=True)


def run_create(slug: str, name: str) -> None:
    """Run create.sh detached, streaming its output to the client's log file."""
    logpath = os.path.join(LOG_DIR, f"{slug}.log")
    with open(logpath, "ab", buffering=0) as log:
        log.write(f"\n===== provisioning {slug} =====\n".encode())
        subprocess.run(
            ["bash", CREATE_SH, slug, name],
            stdout=log, stderr=subprocess.STDOUT,
            env={**os.environ},
        )


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self) -> bool:
        got = self.headers.get("X-Provision-Secret", "")
        return bool(SECRET) and hmac.compare_digest(got, SECRET)

    def do_POST(self):
        if self.path != "/provision":
            return self._send(404, {"error": "not found"})
        if not self._authed():
            return self._send(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._send(400, {"error": "bad json"})
        slug = str(data.get("slug", "")).strip().lower()
        name = str(data.get("name", "")).strip()
        if not SLUG_RE.match(slug):
            return self._send(400, {"error": "invalid slug"})
        if not name:
            return self._send(400, {"error": "name required"})
        threading.Thread(target=run_create, args=(slug, name), daemon=True).start()
        return self._send(202, {"ok": True, "status": "provisioning", "slug": slug})

    def do_GET(self):
        if not self.path.startswith("/status/"):
            return self._send(404, {"error": "not found"})
        if not self._authed():
            return self._send(401, {"error": "unauthorized"})
        slug = self.path[len("/status/"):]
        if not SLUG_RE.match(slug):
            return self._send(400, {"error": "invalid slug"})
        logpath = os.path.join(LOG_DIR, f"{slug}.log")
        if not os.path.exists(logpath):
            return self._send(404, {"error": "no log yet"})
        with open(logpath, "r", errors="replace") as f:
            tail = f.read()[-4000:]
        done = "is live:" in tail
        return self._send(200, {"slug": slug, "done": done, "log": tail})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    if not SECRET:
        raise SystemExit("PROVISION_SECRET is not set — refusing to start.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
