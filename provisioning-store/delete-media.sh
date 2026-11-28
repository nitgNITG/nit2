#!/usr/bin/env bash
# ============================================================================
#  delete-media.sh <slug> — delete everything a store put on the platform
#  Cloudinary: every image / video / raw file under stores/<slug>/ (the logo
#  from create-store.sh and all media the store's api uploaded — its
#  CLOUDINARY_ROOT_FOLDER), then the empty folders.
#  Env: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
#  Exit 0 = nothing left (or Cloudinary not configured: nothing was ever uploaded),
#  1 = something could not be deleted (destroy-store.sh reports the teardown failed).
#  Only that one prefix, with its trailing slash, is ever touched: "stores/ab/"
#  can never match "stores/abc/".
# ============================================================================
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"

if [[ -z "${CLOUDINARY_CLOUD_NAME:-}" || -z "${CLOUDINARY_API_KEY:-}" || -z "${CLOUDINARY_API_SECRET:-}" ]]; then
    log "Cloudinary not configured — no store media to delete"
    exit 0
fi

PREFIX="stores/$SLUG/" "$PY" - <<'PY'
import base64, json, os, sys, urllib.error, urllib.parse, urllib.request

cloud, key, secret = (os.environ[k] for k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"))
prefix = os.environ["PREFIX"]
api = os.environ.get("CLOUDINARY_API_BASE", "https://api.cloudinary.com").rstrip("/") + f"/v1_1/{cloud}"
auth = "Basic " + base64.b64encode(f"{key}:{secret}".encode()).decode()


def call(method, path, query=None):
    url = f"{api}{path}" + (f"?{urllib.parse.urlencode(query, doseq=True)}" if query else "")
    req = urllib.request.Request(url, method=method, headers={"Authorization": auth})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read() or b"{}")
        except Exception:
            body = {}
        return e.code, body
    except Exception as e:  # noqa: BLE001
        return 0, {"error": {"message": str(e)}}


failed = []
total = 0
for rtype in ("image", "video", "raw"):
    cursor = None
    for _ in range(200):  # 1000 per call → up to 200k files per type
        q = {"prefix": prefix, "invalidate": "true"}
        if cursor:
            q["next_cursor"] = cursor
        code, body = call("DELETE", f"/resources/{rtype}/upload", q)
        if code != 200:
            failed.append(f"{rtype}: HTTP {code} {body.get('error', {}).get('message', '')}".strip())
            break
        total += sum(1 for v in (body.get("deleted") or {}).values() if v == "deleted")
        cursor = body.get("next_cursor")
        if not body.get("partial") and not cursor:
            break

# Empty folders, deepest first (Cloudinary only deletes empty ones; 404 = already gone).
folders, stack = [], [prefix.rstrip("/")]
while stack:
    f = stack.pop()
    folders.append(f)
    code, body = call("GET", f"/folders/{urllib.parse.quote(f)}")
    if code == 200:
        stack.extend(sub["path"] for sub in body.get("folders", []))
for f in sorted(folders, key=lambda p: p.count("/"), reverse=True):
    code, body = call("DELETE", f"/folders/{urllib.parse.quote(f)}")
    if code not in (200, 404):
        failed.append(f"folder {f}: HTTP {code} {body.get('error', {}).get('message', '')}".strip())

print(f"==> deleted {total} Cloudinary file(s) under {prefix}")
if failed:
    print("!! " + "; ".join(failed), file=sys.stderr)
    sys.exit(1)
PY
