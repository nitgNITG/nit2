#!/usr/bin/env python3
"""
Minimal provisioning endpoint for server B.

  POST /provision   body {"slug","name"}   header  X-Provision-Secret: <secret>
    → runs create.sh <slug> "<name>" in the BACKGROUND, logs to
      /opt/saas/logs/<slug>.log, returns 202 immediately.
  GET  /status/<slug>   header X-Provision-Secret
    → returns the tail of that client's provisioning log.
  DELETE /deprovision/<slug>   header X-Provision-Secret
    → runs destroy.sh <slug> in the BACKGROUND (container + db + files + vhosts),
      logs to /opt/saas/logs/<slug>.log, returns 202 immediately.

Security: shared-secret auth, strict slug validation, args passed as a list
(never a shell string), bound to 127.0.0.1 (reached only via the Apache vhost).
No third-party dependencies — Python 3 stdlib only.
"""
import os, re, json, hmac, base64, shutil, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET           = os.environ.get("PROVISION_SECRET", "")
CREATE_SH        = os.environ.get("CREATE_SH", "/root/create.sh")
DESTROY_SH       = os.environ.get("DESTROY_SH", "/root/destroy.sh")
APPLY_LICENSE_SH = os.environ.get("APPLY_LICENSE_SH", "/root/apply-license.sh")
APPLY_SETTINGS_SH = os.environ.get("APPLY_SETTINGS_SH", "/root/apply-settings.sh")
LOG_DIR     = os.environ.get("PROVISION_LOG_DIR", "/opt/saas/logs")
STAGING_DIR = os.environ.get("PROVISION_STAGING_DIR", "/opt/saas/staging")
PORT        = int(os.environ.get("PROVISION_PORT", "9099"))
SLUG_RE     = re.compile(r"^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$")
TIERS       = {"demo", "basic", "standard", "professional"}
# Global platform-settings keys we accept and forward to create.sh (as SETTING_<KEY>).
# Whitelisted so a caller can't inject arbitrary Moodle config names.
SETTING_KEYS = {
    "google_client_id", "apple_client_id", "facebook_app_id",
    "android_version", "android_url", "ios_version", "ios_url",
}

MAX_BODY   = 12 * 1024 * 1024   # 12 MB total request (base64 inflates ~33%)
MAX_IMAGE  = 3 * 1024 * 1024    # 3 MB per decoded image
# extension -> magic-byte prefixes that must match (SVG is validated as text).
IMAGE_MAGIC = {
    "png":  [b"\x89PNG\r\n\x1a\n"],
    "jpg":  [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "gif":  [b"GIF87a", b"GIF89a"],
    "webp": [b"RIFF"],
    "ico":  [b"\x00\x00\x01\x00"],
    "svg":  [],
}

os.makedirs(LOG_DIR, exist_ok=True)


def _stage_image(dirpath: str, kind: str, spec) -> str:
    """
    Decode one branding image (dict {filename, data_b64}) into the staging dir.
    Returns the written path, or "" if absent/invalid. Never raises — a bad
    image is skipped so it can't abort provisioning.
    """
    if not isinstance(spec, dict):
        return ""
    b64 = spec.get("data_b64") or ""
    if not b64:
        return ""
    ext = os.path.splitext(str(spec.get("filename", "")))[1].lower().lstrip(".")
    if ext not in IMAGE_MAGIC:
        return ""
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception:
        return ""
    if not raw or len(raw) > MAX_IMAGE:
        return ""
    magics = IMAGE_MAGIC[ext]
    if ext == "svg":
        head = raw[:512].lstrip().lower()
        if not (head.startswith(b"<?xml") or head.startswith(b"<svg")):
            return ""
    elif not any(raw.startswith(m) for m in magics):
        return ""
    path = os.path.join(dirpath, f"{kind}.{ext}")
    with open(path, "wb") as f:
        f.write(raw)
    return path


def run_create(slug: str, name: str, brand: dict, tier: str = "demo", settings: dict = None) -> None:
    """Run create.sh detached, streaming its output to the client's log file.

    Branding is passed through create.sh's BRAND_* env contract: names as
    strings, logo/favicon as staged file paths (decoded from base64 here).
    The licence tier is passed as LICENSE_TIER (create.sh sets local_license).
    Global platform settings are passed as SETTING_<KEY> (create.sh sets
    local_multitopics), whitelisted to SETTING_KEYS.
    """
    logpath = os.path.join(LOG_DIR, f"{slug}.log")
    stage = os.path.join(STAGING_DIR, slug)
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(stage, exist_ok=True)

    env = {**os.environ}
    env["LICENSE_TIER"] = tier if tier in TIERS else "demo"
    if isinstance(settings, dict):
        for key, val in settings.items():
            if key in SETTING_KEYS and isinstance(val, str) and val.strip():
                env["SETTING_" + key.upper()] = val.strip()
    if isinstance(brand, dict):
        for key in ("fullname_ar", "fullname_en", "shortname_ar", "shortname_en"):
            val = str(brand.get(key, "") or "").strip()
            if val:
                env["BRAND_" + key.upper()] = val
        logo = _stage_image(stage, "logo", brand.get("logo"))
        if logo:
            env["BRAND_LOGO"] = logo
        logocompact = _stage_image(stage, "logocompact", brand.get("logocompact"))
        if logocompact:
            env["BRAND_LOGOCOMPACT"] = logocompact
        favicon = _stage_image(stage, "favicon", brand.get("favicon"))
        if favicon:
            env["BRAND_FAVICON"] = favicon

    try:
        with open(logpath, "ab", buffering=0) as log:
            log.write(f"\n===== provisioning {slug} =====\n".encode())
            subprocess.run(
                ["bash", CREATE_SH, slug, name],
                stdout=log, stderr=subprocess.STDOUT,
                env=env,
            )
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def run_destroy(slug: str) -> None:
    """Run destroy.sh detached, appending its output to the client's log file."""
    logpath = os.path.join(LOG_DIR, f"{slug}.log")
    with open(logpath, "ab", buffering=0) as log:
        log.write(f"\n===== deprovisioning {slug} =====\n".encode())
        subprocess.run(
            ["bash", DESTROY_SH, slug],
            stdout=log, stderr=subprocess.STDOUT,
            env={**os.environ},
        )


def run_apply_license(slug: str, tier: str) -> None:
    """Run apply-license.sh detached — set/change the tier on a live academy."""
    logpath = os.path.join(LOG_DIR, f"{slug}.log")
    with open(logpath, "ab", buffering=0) as log:
        log.write(f"\n===== apply-license {slug} -> {tier} =====\n".encode())
        subprocess.run(
            ["bash", APPLY_LICENSE_SH, slug, tier],
            stdout=log, stderr=subprocess.STDOUT,
            env={**os.environ},
        )


def run_apply_settings(slug: str, settings: dict) -> None:
    """Run apply-settings.sh detached — (re)push global settings to a live academy."""
    env = {**os.environ}
    if isinstance(settings, dict):
        for key, val in settings.items():
            if key in SETTING_KEYS and isinstance(val, str) and val.strip():
                env["SETTING_" + key.upper()] = val.strip()
    logpath = os.path.join(LOG_DIR, f"{slug}.log")
    with open(logpath, "ab", buffering=0) as log:
        log.write(f"\n===== apply-settings {slug} =====\n".encode())
        subprocess.run(
            ["bash", APPLY_SETTINGS_SH, slug],
            stdout=log, stderr=subprocess.STDOUT,
            env=env,
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
        if not self._authed():
            return self._send(401, {"error": "unauthorized"})

        # POST /apply-license/<slug>  {"tier": "..."} — change tier on a live academy.
        if self.path.startswith("/apply-license/"):
            slug = self.path[len("/apply-license/"):]
            if not SLUG_RE.match(slug):
                return self._send(400, {"error": "invalid slug"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                data = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                return self._send(400, {"error": "bad json"})
            tier = str(data.get("tier", "demo")).strip().lower()
            if tier not in TIERS:
                tier = "demo"
            threading.Thread(target=run_apply_license, args=(slug, tier), daemon=True).start()
            return self._send(202, {"ok": True, "status": "applying-license", "slug": slug, "tier": tier})

        # POST /apply-settings/<slug>  {"settings": {...}} — re-push global settings.
        if self.path.startswith("/apply-settings/"):
            slug = self.path[len("/apply-settings/"):]
            if not SLUG_RE.match(slug):
                return self._send(400, {"error": "invalid slug"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                data = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                return self._send(400, {"error": "bad json"})
            settings = data.get("settings") if isinstance(data.get("settings"), dict) else {}
            threading.Thread(target=run_apply_settings, args=(slug, settings), daemon=True).start()
            return self._send(202, {"ok": True, "status": "applying-settings", "slug": slug})

        if self.path != "/provision":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_BODY:
                return self._send(413, {"error": "payload too large"})
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._send(400, {"error": "bad json"})
        slug = str(data.get("slug", "")).strip().lower()
        name = str(data.get("name", "")).strip()
        brand = data.get("brand") if isinstance(data.get("brand"), dict) else {}
        settings = data.get("settings") if isinstance(data.get("settings"), dict) else {}
        tier = str(data.get("tier", "demo")).strip().lower()
        if tier not in TIERS:
            tier = "demo"
        if not SLUG_RE.match(slug):
            return self._send(400, {"error": "invalid slug"})
        if not name:
            return self._send(400, {"error": "name required"})
        threading.Thread(target=run_create, args=(slug, name, brand, tier, settings), daemon=True).start()
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

    def do_DELETE(self):
        if not self.path.startswith("/deprovision/"):
            return self._send(404, {"error": "not found"})
        if not self._authed():
            return self._send(401, {"error": "unauthorized"})
        slug = self.path[len("/deprovision/"):]
        if not SLUG_RE.match(slug):
            return self._send(400, {"error": "invalid slug"})
        threading.Thread(target=run_destroy, args=(slug,), daemon=True).start()
        return self._send(202, {"ok": True, "status": "deprovisioning", "slug": slug})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    if not SECRET:
        raise SystemExit("PROVISION_SECRET is not set — refusing to start.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
