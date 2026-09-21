#!/usr/bin/env python3
"""
Store provisioning endpoint — the store counterpart of provisioning/provision-server.py.

  POST   /provision                 body: the create request (see _build_create_job)   → 202 {job, status:"queued"}
  GET    /status/<slug>             → {job, kind, state, step, total, label, url, error, log_tail}
  POST   /apply-license/<slug>      {tier, definition, expires_at, subscribed_at, grace_days, renew_url} → sync
  POST   /suspend/<slug>            {suspended: bool} → sync
  POST   /reset-owner/<slug>        {email?} → sync, returns the CLI JSON (contains the new password)
  POST   /update-image/<slug>       {tag} → queued job
  POST   /update-image              {tag} → bump-image.sh --all, detached (rollout of every store)
  POST   /bind-domain/<slug>        {domain} → queued job     POST /unbind-domain/<slug> → queued job
  GET    /domain-status/<slug>
  DELETE /deprovision/<slug>        → queued job (destroy-store.sh)
  GET    /health · GET /usage       host snapshot / per-store sizes
  POST   /_progress/<slug>          internal: scripts report steps (lib.sh); persisted + forwarded to nit2

Differences from the academy service, on purpose:
  * jobs are persisted in jobs.sqlite and run by a small worker pool — a service
    restart marks in-flight jobs failed (and tells nit2) instead of losing them;
  * every step is reported to nit2 (POST $CALLBACK_URL/api/tenants/<slug>/progress,
    header x-worker-secret), and every job ends with an explicit done|failed;
  * scripts run in their own session, so restarting the service never kills a job.

Security: shared-secret header (constant-time compare), strict slug/tag/domain
validation, args passed as lists, bound to 127.0.0.1. Python 3 stdlib only.
"""
import base64, hmac, json, os, queue, re, shutil, sqlite3, subprocess, threading, time, glob
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET       = os.environ.get("PROVISION_SECRET", "")
PORT         = int(os.environ.get("PROVISION_PORT", "9098"))
STORE_ROOT   = os.environ.get("STORE_ROOT", "/var/www/html/saas-stores")
SCRIPTS_DIR  = os.environ.get("SCRIPTS_DIR", STORE_ROOT)
LOG_DIR      = os.path.join(STORE_ROOT, "logs")
STAGING_DIR  = os.path.join(STORE_ROOT, "staging")
DB_PATH      = os.path.join(STORE_ROOT, "jobs.sqlite")
CALLBACK_URL = os.environ.get("CALLBACK_URL", "").rstrip("/")
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
MAX_CONCURRENT = max(1, int(os.environ.get("MAX_CONCURRENT", "2") or "2"))
DB_CONTAINER = os.environ.get("SAAS_DB_CONTAINER", "saas_mariadb")
DEFAULT_TAG  = os.environ.get("IMAGE_TAG", "latest")
BASH         = os.environ.get("BASH_BIN", "bash")   # explicit path only needed on non-Linux dev boxes

SLUG_RE   = re.compile(r"^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$")
TIER_RE   = re.compile(r"^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$")
TAG_RE    = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
DOMAIN_RE = re.compile(r"^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
EMAIL_RE  = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_BODY  = 12 * 1024 * 1024
MAX_IMAGE = int(os.environ.get("MAX_IMAGE_MB", "5") or "5") * 1024 * 1024
IMAGE_MAGIC = {
    "png": [b"\x89PNG\r\n\x1a\n"], "jpg": [b"\xff\xd8\xff"], "jpeg": [b"\xff\xd8\xff"],
    "gif": [b"GIF87a", b"GIF89a"], "webp": [b"RIFF"], "svg": [],
}

for d in (LOG_DIR, STAGING_DIR, os.path.join(STORE_ROOT, "clients")):
    os.makedirs(d, exist_ok=True)


def script(name: str) -> str:
    return os.path.join(SCRIPTS_DIR, name)


# ── Job store (SQLite) ────────────────────────────────────────────────────────
_db_lock = threading.Lock()


def _db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, kind TEXT NOT NULL,
            state TEXT NOT NULL, step INTEGER DEFAULT 0, total INTEGER DEFAULT 0, label TEXT DEFAULT '',
            url TEXT DEFAULT '', error TEXT DEFAULT '', extra TEXT DEFAULT '{}',
            created_at INTEGER, started_at INTEGER, finished_at INTEGER)""")
        c.execute("CREATE INDEX IF NOT EXISTS jobs_slug ON jobs(slug, id)")


def job_create(slug: str, kind: str) -> int:
    with _db_lock, _db() as c:
        cur = c.execute("INSERT INTO jobs(slug, kind, state, created_at) VALUES (?,?,?,?)",
                        (slug, kind, "queued", int(time.time())))
        return cur.lastrowid


def job_update(job_id: int, **fields):
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with _db_lock, _db() as c:
        c.execute(f"UPDATE jobs SET {cols} WHERE id=?", (*fields.values(), job_id))


def job_get(job_id: int):
    with _db() as c:
        return c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()


def job_latest(slug: str):
    with _db() as c:
        return c.execute("SELECT * FROM jobs WHERE slug=? ORDER BY id DESC LIMIT 1", (slug,)).fetchone()


def job_active(slug: str):
    with _db() as c:
        return c.execute("SELECT * FROM jobs WHERE slug=? AND state IN ('queued','running') ORDER BY id DESC LIMIT 1",
                         (slug,)).fetchone()


def _row(r) -> dict:
    d = dict(r) if r else {}
    if d.get("extra"):
        try:
            d["extra"] = json.loads(d["extra"])
        except Exception:
            d["extra"] = {}
    return d


# ── Callback to nit2 ─────────────────────────────────────────────────────────
def notify(slug: str, payload: dict):
    """POST progress to nit2. Best effort: 3 s timeout, never raises."""
    if not CALLBACK_URL or not WORKER_SECRET:
        return
    body = json.dumps({"product": "store", "slug": slug, **payload}).encode()
    req = urllib.request.Request(
        f"{CALLBACK_URL}/api/tenants/{slug}/progress", data=body, method="POST",
        headers={"Content-Type": "application/json", "x-worker-secret": WORKER_SECRET},
    )
    try:
        urllib.request.urlopen(req, timeout=3).read()
    except Exception as e:  # noqa: BLE001
        print(f"[callback] {slug}: {e}", flush=True)


def apply_progress(slug: str, job_id: int, data: dict):
    """Persist a step/done/failed report from a script and forward it to nit2."""
    state = str(data.get("state", "running"))
    fields = {}
    if state == "running":
        fields = {"state": "running", "step": int(data.get("step", 0) or 0),
                  "total": int(data.get("total", 0) or 0), "label": str(data.get("label", ""))[:200]}
    elif state == "done":
        extra = {k: v for k, v in data.items() if k not in ("job", "state", "url")}
        fields = {"state": "done", "url": str(data.get("url", "")), "finished_at": int(time.time()),
                  "extra": json.dumps(extra, ensure_ascii=False)}
    elif state == "failed":
        fields = {"state": "failed", "error": str(data.get("error", ""))[:2000], "finished_at": int(time.time())}
    else:
        return
    job_update(job_id, **fields)
    row = _row(job_get(job_id))
    notify(slug, {"job": job_id, "kind": row.get("kind"), "state": row.get("state"), "step": row.get("step"),
                  "total": row.get("total"), "label": row.get("label"), "url": row.get("url"),
                  "error": row.get("error"), **(row.get("extra") or {})})


# ── Worker pool ──────────────────────────────────────────────────────────────
_queue: "queue.Queue[tuple[int, list, dict, str]]" = queue.Queue()


def enqueue(job_id: int, argv: list, env: dict, slug: str):
    _queue.put((job_id, argv, env, slug))


def _run_job(job_id: int, argv: list, extra_env: dict, slug: str):
    job_update(job_id, state="running", started_at=int(time.time()))
    row = _row(job_get(job_id))
    notify(slug, {"job": job_id, "kind": row.get("kind"), "state": "running", "step": 0, "total": 0, "label": "Starting"})
    logpath = os.path.join(LOG_DIR, f"{slug}.log")
    env = {**os.environ, **extra_env, "STORE_JOB": str(job_id), "SCRIPTS_DIR": SCRIPTS_DIR}
    rc = -1
    with open(logpath, "ab", buffering=0) as log:
        log.write(f"\n===== job {job_id} {row.get('kind')} {slug} {time.strftime('%F %T')} =====\n".encode())
        try:
            # Own session: a service restart (KillMode=mixed) never kills the job.
            p = subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True)
            rc = p.wait()
        except Exception as e:  # noqa: BLE001
            log.write(f"!! failed to start job: {e}\n".encode())
    final = _row(job_get(job_id))
    if final.get("state") in ("done", "failed"):
        return  # the script already reported its outcome
    if rc == 0:
        apply_progress(slug, job_id, {"state": "done", "url": final.get("url", "")})
    else:
        tail = _log_tail(slug, 600).strip().splitlines()
        last = next((l for l in reversed(tail) if l.strip()), "")
        apply_progress(slug, job_id, {"state": "failed", "error": f"exit {rc}: {last}"[:500]})


def _worker():
    while True:
        job_id, argv, env, slug = _queue.get()
        try:
            _run_job(job_id, argv, env, slug)
        finally:
            for path in glob.glob(os.path.join(STAGING_DIR, f"{slug}", "*")):
                try:
                    os.remove(path)
                except OSError:
                    pass
            _queue.task_done()


def _recover_on_start():
    """Jobs left queued/running by a previous process die with it: say so."""
    with _db() as c:
        rows = c.execute("SELECT id, slug FROM jobs WHERE state IN ('queued','running')").fetchall()
    for r in rows:
        apply_progress(r["slug"], r["id"], {"state": "failed", "error": "provisioner restarted while the job was running"})


def _log_tail(slug: str, n: int = 4000) -> str:
    try:
        with open(os.path.join(LOG_DIR, f"{slug}.log"), "r", errors="replace") as f:
            return f.read()[-n:]
    except OSError:
        return ""


# ── Request → job builders ───────────────────────────────────────────────────
def _stage_logo(slug: str, spec) -> str:
    """Decode {filename, data_b64} into staging/<slug>/logo.<ext>; '' when absent/invalid."""
    if not isinstance(spec, dict) or not spec.get("data_b64"):
        return ""
    ext = os.path.splitext(str(spec.get("filename", "")))[1].lower().lstrip(".")
    if ext not in IMAGE_MAGIC:
        return ""
    try:
        raw = base64.b64decode(spec["data_b64"], validate=True)
    except Exception:
        return ""
    if not raw or len(raw) > MAX_IMAGE:
        return ""
    if ext == "svg":
        head = raw[:512].lstrip().lower()
        if not (head.startswith(b"<?xml") or head.startswith(b"<svg")):
            return ""
    elif not any(raw.startswith(m) for m in IMAGE_MAGIC[ext]):
        return ""
    d = os.path.join(STAGING_DIR, slug)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"logo.{ext}")
    with open(path, "wb") as f:
        f.write(raw)
    return path


def _license_doc(data: dict) -> dict:
    """Normalise nit2's licence fields into the store-api CLI's licence document."""
    tier = str(data.get("tier", "")).strip().lower()
    if not TIER_RE.match(tier):
        raise ValueError("invalid tier")
    definition = data.get("definition", {})
    if isinstance(definition, str):
        try:
            definition = json.loads(definition) if definition.strip() else {}
        except Exception:
            raise ValueError("definition is not valid JSON")
    if not isinstance(definition, dict):
        raise ValueError("definition must be an object")
    doc = {"tier": tier, "definition": definition}
    for k in ("expires_at", "subscribed_at", "renew_url"):
        v = data.get(k)
        if isinstance(v, str) and v.strip():
            doc[k] = v.strip()
        elif v is None and k in data:
            doc[k] = None
    grace = data.get("grace_days")
    if isinstance(grace, (int, float)) and grace >= 0:
        doc["grace_days"] = int(grace)
    return doc


def _build_create_job(data: dict) -> tuple[str, list, dict]:
    slug = str(data.get("slug", "")).strip().lower()
    if not SLUG_RE.match(slug):
        raise ValueError("invalid slug")
    name = str(data.get("name", "")).strip()
    if not name or len(name) > 150:
        raise ValueError("invalid name")
    owner = data.get("owner") or {}
    email = str(owner.get("email", "")).strip()
    if not EMAIL_RE.match(email):
        raise ValueError("invalid owner.email")
    store = data.get("store") or {}
    bootstrap = {
        "name": name,
        "name_ar": (str(data.get("name_ar")).strip()[:150] if data.get("name_ar") else None),
        "country": str(store.get("country", "EG")).upper()[:2],
        "currency": str(store.get("currency", "EGP")).upper()[:3],
        "timezone": str(store.get("timezone", "Africa/Cairo"))[:64],
        "default_locale": "en" if str(store.get("default_locale", "ar")).lower() == "en" else "ar",
        "owner": {
            "email": email,
            "name": str(owner.get("name", "")).strip()[:100] or email.split("@")[0],
            "locale": "en" if str(owner.get("locale", "ar")).lower() == "en" else "ar",
        },
        "send_welcome": data.get("send_welcome", True) is not False,
    }
    # nit2 generates the owner password (stored encrypted there); optional.
    pw = owner.get("password")
    if isinstance(pw, str) and len(pw) >= 8:
        bootstrap["owner"]["password"] = pw
    for k in ("vat_rate", "prices_include_vat", "theme", "contact", "social", "seo_title", "seo_title_ar", "logo_url", "favicon_url"):
        if k in store and store[k] is not None:
            bootstrap[k] = store[k]
    if data.get("tier") or data.get("license"):
        lic = {**(data.get("license") or {})}
        lic.setdefault("tier", data.get("tier"))
        lic.setdefault("definition", data.get("definition", {}))
        bootstrap["license"] = _license_doc(lic)
    tag = str(data.get("image_tag") or DEFAULT_TAG)
    if not TAG_RE.match(tag):
        raise ValueError("invalid image_tag")
    env = {"BOOTSTRAP_JSON": json.dumps(bootstrap, ensure_ascii=False), "IMAGE_TAG": tag}
    if data.get("force") is True:
        env["FORCE_RECREATE"] = "1"   # create-store.sh destroys leftovers first
    logo = _stage_logo(slug, store.get("logo"))
    if logo:
        env["LOGO_PATH"] = logo
    return slug, [BASH, script("create-store.sh"), slug, name], env


def _run_sync(argv: list, stdin: str = "", timeout: int = 120) -> tuple[int, str]:
    env = {**os.environ, "SCRIPTS_DIR": SCRIPTS_DIR}
    p = subprocess.run(argv, input=stdin.encode() if stdin else None, capture_output=True, env=env, timeout=timeout)
    out = (p.stdout or b"").decode(errors="replace").strip()
    err = (p.stderr or b"").decode(errors="replace").strip()
    return p.returncode, out if p.returncode == 0 else (out + "\n" + err).strip()


def _last_json_line(text: str):
    for line in reversed(text.splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except Exception:
                pass
    return None


def run_bump_all(tag: str):
    logpath = os.path.join(LOG_DIR, "bump-image.log")
    log = open(logpath, "ab", buffering=0)
    log.write(f"\n===== update-image -> {tag} (all) {time.strftime('%F %T')} =====\n".encode())
    subprocess.Popen([BASH, script("bump-image.sh"), tag, "--all"], stdout=log, stderr=subprocess.STDOUT,
                     env={**os.environ, "SCRIPTS_DIR": SCRIPTS_DIR}, start_new_session=True)


# ── Health / usage ───────────────────────────────────────────────────────────
_CACHE = {"health": (0.0, None), "usage": (0.0, None)}


def _read(path: str) -> str:
    try:
        with open(path) as f:
            return f.read()
    except Exception:
        return ""


def _disk() -> dict:
    try:
        du = shutil.disk_usage(STORE_ROOT)
        return {"path": STORE_ROOT, "total_bytes": du.total, "used_bytes": du.used, "free_bytes": du.free,
                "used_pct": round(du.used * 100 / du.total) if du.total else 0,
                "free_pct": round(du.free * 100 / du.total) if du.total else 0}
    except Exception:
        return {"path": STORE_ROOT, "total_bytes": 0, "used_bytes": 0, "free_bytes": 0, "used_pct": 0, "free_pct": 0}


def collect_health() -> dict:
    at, data = _CACHE["health"]
    if data and time.time() - at < 15:
        return data
    mem = {}
    for line in _read("/proc/meminfo").splitlines():
        k, _, v = line.partition(":")
        mem[k.strip()] = v.strip()
    kb = lambda x: int(x.split()[0]) * 1024 if x else 0  # noqa: E731
    total, avail = kb(mem.get("MemTotal", "")), kb(mem.get("MemAvailable", ""))
    la = _read("/proc/loadavg").split()
    ncpu = os.cpu_count() or 1
    up = _read("/proc/uptime").split()
    try:
        out = subprocess.run(["systemctl", "--failed", "--no-legend", "--plain", "--no-pager"],
                             capture_output=True, text=True, timeout=15)
        failed = [l.split()[0] for l in out.stdout.splitlines() if l.strip()]
    except Exception:
        failed = []
    try:
        out = subprocess.run(["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True, timeout=15)
        names = [n for n in out.stdout.splitlines() if n.strip()]
        docker = {"running": len(names), "mariadb_up": DB_CONTAINER in names,
                  "stores": len({n.rsplit("-", 2)[0] for n in names if n.startswith("store_")})}
    except Exception:
        docker = {"running": 0, "mariadb_up": False, "stores": 0}
    with _db() as c:
        active = c.execute("SELECT COUNT(*) FROM jobs WHERE state IN ('queued','running')").fetchone()[0]
    data = {
        "disk": _disk(),
        "memory": {"total_bytes": total, "available_bytes": avail,
                   "used_pct": round((total - avail) * 100 / total) if total else 0},
        "cpu": {"count": ncpu, "load1": float(la[0]) if la else 0.0,
                "load5": float(la[1]) if len(la) > 1 else 0.0, "load15": float(la[2]) if len(la) > 2 else 0.0,
                "load1_per_core": round(float(la[0]) / ncpu, 2) if la else 0.0},
        "uptime_seconds": int(float(up[0])) if up else 0, "failed_services": failed,
        "docker": docker, "jobs_active": active, "image_tag": DEFAULT_TAG,
        "generated_at": int(time.time()),
    }
    _CACHE["health"] = (time.time(), data)
    return data


def collect_usage() -> dict:
    at, data = _CACHE["usage"]
    if data and time.time() - at < 30:
        return data
    stores = {}
    for envf in sorted(glob.glob(os.path.join(STORE_ROOT, "clients", "*", "store.env"))):
        slug = os.path.basename(os.path.dirname(envf))
        if not SLUG_RE.match(slug):
            continue
        tag = ""
        for line in _read(envf).splitlines():
            if line.startswith("IMAGE_TAG="):
                tag = line.split("=", 1)[1].strip()
        stores[slug] = {"image_tag": tag}
    # Per-schema sizes from the shared MariaDB (one query for all).
    try:
        pw = os.environ.get("DB_ROOT_PW", "")
        out = subprocess.run(
            ["docker", "exec", DB_CONTAINER, "mariadb", "-uroot", f"-p{pw}", "-N", "-e",
             "SELECT table_schema, COALESCE(SUM(data_length+index_length),0) FROM information_schema.tables "
             "WHERE table_schema LIKE 'store\\_%' GROUP BY table_schema"],
            capture_output=True, text=True, timeout=30)
        for line in out.stdout.splitlines():
            schema, _, size = line.partition("\t")
            slug = schema[len("store_"):].replace("_", "-")
            if slug in stores:
                stores[slug]["db_bytes"] = int(size or 0)
    except Exception:
        pass
    snap = _disk()
    data = {"stores": stores, "host_disk_pct": snap["used_pct"], "host_free_bytes": snap["free_bytes"],
            "host_total_bytes": snap["total_bytes"], "generated_at": int(time.time())}
    _CACHE["usage"] = (time.time(), data)
    return data


# ── HTTP ─────────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self) -> bool:
        return bool(SECRET) and hmac.compare_digest(self.headers.get("X-Provision-Secret", ""), SECRET)

    def _json(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > MAX_BODY:
            raise ValueError("body too large")
        raw = self.rfile.read(length) if length else b"{}"
        data = json.loads(raw or b"{}")
        if not isinstance(data, dict):
            raise ValueError("object expected")
        return data

    def _slug_from(self, prefix: str) -> str:
        slug = self.path[len(prefix):].split("?", 1)[0]
        if not SLUG_RE.match(slug):
            raise ValueError("invalid slug")
        return slug

    def _queue_job(self, slug: str, kind: str, argv: list, env: dict | None = None):
        if job_active(slug):
            return self._send(409, {"error": "a job is already running for this slug"})
        job_id = job_create(slug, kind)
        enqueue(job_id, argv, env or {}, slug)
        return self._send(202, {"ok": True, "job": job_id, "status": "queued", "slug": slug})

    def do_POST(self):
        if not self._authed():
            return self._send(401, {"error": "unauthorized"})
        try:
            path = self.path.split("?", 1)[0]

            if path.startswith("/_progress/"):   # internal, from lib.sh
                slug = self._slug_from("/_progress/")
                data = self._json()
                job_id = int(data.get("job") or 0)
                row = job_get(job_id) if job_id else None
                if not row or row["slug"] != slug:
                    return self._send(404, {"error": "unknown job"})
                apply_progress(slug, job_id, data)
                return self._send(200, {"ok": True})

            if path == "/provision":
                data = self._json()
                slug, argv, env = _build_create_job(data)
                if os.path.isdir(os.path.join(STORE_ROOT, "clients", slug)) and env.get("FORCE_RECREATE") != "1":
                    return self._send(409, {"error": "store already exists"})
                return self._queue_job(slug, "create", argv, env)

            if path.startswith("/apply-license/"):
                slug = self._slug_from("/apply-license/")
                doc = _license_doc(self._json())
                rc, out = _run_sync([BASH, script("apply-license.sh"), slug], json.dumps(doc))
                res = _last_json_line(out) or {}
                return self._send(200 if rc == 0 else 500, {"ok": rc == 0, "slug": slug, "result": res, **({} if rc == 0 else {"error": out[-800:]})})

            if path.startswith("/suspend/"):
                slug = self._slug_from("/suspend/")
                suspended = bool(self._json().get("suspended", True))
                rc, out = _run_sync([BASH, script("apply-suspend.sh"), slug, "on" if suspended else "off"])
                return self._send(200 if rc == 0 else 500, {"ok": rc == 0, "slug": slug, "suspended": suspended, **({} if rc == 0 else {"error": out[-800:]})})

            if path.startswith("/reset-owner/"):
                slug = self._slug_from("/reset-owner/")
                email = str(self._json().get("email", "")).strip()
                argv = [BASH, script("reset-owner.sh"), slug] + ([email] if email and EMAIL_RE.match(email) else [])
                rc, out = _run_sync(argv)
                res = _last_json_line(out) or {}
                return self._send(200 if rc == 0 else 500, {"ok": rc == 0, "slug": slug, **res, **({} if rc == 0 else {"error": out[-800:]})})

            if path == "/update-image":
                tag = str(self._json().get("tag", "")).strip()
                if not TAG_RE.match(tag):
                    return self._send(400, {"error": "invalid tag"})
                run_bump_all(tag)
                return self._send(202, {"ok": True, "status": "rolling-out", "tag": tag})

            if path.startswith("/update-image/"):
                slug = self._slug_from("/update-image/")
                tag = str(self._json().get("tag", "")).strip()
                if not TAG_RE.match(tag):
                    return self._send(400, {"error": "invalid tag"})
                return self._queue_job(slug, "update-image", [BASH, script("update-image.sh"), slug, tag], {"FORCE": "1"})

            if path.startswith("/bind-domain/"):
                slug = self._slug_from("/bind-domain/")
                domain = str(self._json().get("domain", "")).strip().lower()
                if not DOMAIN_RE.match(domain):
                    return self._send(400, {"error": "invalid domain"})
                return self._queue_job(slug, "bind-domain", [BASH, script("bind-domain.sh"), slug, domain])

            if path.startswith("/unbind-domain/"):
                slug = self._slug_from("/unbind-domain/")
                return self._queue_job(slug, "unbind-domain", [BASH, script("unbind-domain.sh"), slug])

            return self._send(404, {"error": "not found"})
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        except subprocess.TimeoutExpired:
            return self._send(504, {"error": "script timed out"})
        except Exception as e:  # noqa: BLE001
            return self._send(500, {"error": f"internal: {e}"})

    def do_GET(self):
        if not self._authed():
            return self._send(401, {"error": "unauthorized"})
        try:
            path = self.path.split("?", 1)[0]
            if path == "/health":
                return self._send(200, collect_health())
            if path == "/usage":
                return self._send(200, collect_usage())
            if path.startswith("/domain-status/"):
                slug = self._slug_from("/domain-status/")
                try:
                    with open(os.path.join(STORE_ROOT, "clients", slug, "domain-status.json")) as f:
                        return self._send(200, json.load(f))
                except Exception:
                    return self._send(200, {"state": "none"})
            if path.startswith("/status/"):
                slug = self._slug_from("/status/")
                row = _row(job_latest(slug))
                exists = os.path.isfile(os.path.join(STORE_ROOT, "clients", slug, "store.env"))
                if not row and not exists:
                    return self._send(404, {"error": "unknown store"})
                return self._send(200, {"slug": slug, "exists": exists, **{k: row.get(k) for k in
                                        ("id", "kind", "state", "step", "total", "label", "url", "error", "extra",
                                         "created_at", "started_at", "finished_at")},
                                        "done": row.get("state") == "done", "log_tail": _log_tail(slug)})
            return self._send(404, {"error": "not found"})
        except ValueError as e:
            return self._send(400, {"error": str(e)})

    def do_DELETE(self):
        if not self._authed():
            return self._send(401, {"error": "unauthorized"})
        try:
            if not self.path.startswith("/deprovision/"):
                return self._send(404, {"error": "not found"})
            slug = self._slug_from("/deprovision/")
            return self._queue_job(slug, "destroy", [BASH, script("destroy-store.sh"), slug])
        except ValueError as e:
            return self._send(400, {"error": str(e)})

    def log_message(self, *a):  # quiet; jobs log to files
        pass


if __name__ == "__main__":
    if not SECRET:
        raise SystemExit("PROVISION_SECRET is not set — refusing to start.")
    _init_db()
    _recover_on_start()
    for _ in range(MAX_CONCURRENT):
        threading.Thread(target=_worker, daemon=True).start()
    print(f"store provisioner on 127.0.0.1:{PORT} root={STORE_ROOT} workers={MAX_CONCURRENT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
