#!/usr/bin/env bash
# ============================================================================
#  apply-config.sh KEY [KEY…] — copy the given provision.env keys (already
#  rewritten by POST /config) into every store's store.env and let compose
#  recreate the containers whose environment changed. Called detached by the
#  service; log in logs/apply-config.log. Pinned stores are NOT skipped: this is
#  configuration, not an image change.
# ============================================================================
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
[[ $# -gt 0 ]] || die "usage: apply-config.sh KEY [KEY…]"
PROV="$STORE_ROOT/provision.env"

OK=(); FAILED=()
for envf in "$STORE_ROOT"/clients/*/store.env; do
    [[ -f "$envf" ]] || continue
    slug="$(basename "$(dirname "$envf")")"
    log "----- $slug"
    # Values may contain spaces, quotes, & or | (MAIL_FROM, passwords): rewrite
    # the file line by line instead of sed.
    "$PYTHON_BIN" - "$PROV" "$envf" "$@" <<'PY'
import sys
prov, envf, keys = sys.argv[1], sys.argv[2], sys.argv[3:]
src = {}
for line in open(prov):
    if "=" in line and not line.startswith("#"):
        k, v = line.rstrip("\n").split("=", 1)
        src[k] = v
lines = open(envf).read().splitlines()
seen = set(); out = []
for line in lines:
    k = line.split("=", 1)[0] if "=" in line and not line.startswith("#") else None
    if k in keys:
        seen.add(k); out.append(f"{k}={src.get(k, '')}")
    else:
        out.append(line)
for k in keys:
    if k not in seen:
        out.append(f"{k}={src.get(k, '')}")
open(envf, "w").write("\n".join(out) + "\n")
PY
    store_paths "$slug"
    # compose compares the rendered config: unchanged env → nothing restarts.
    if compose up -d --remove-orphans 2>&1 | grep -v '^$'; then :; fi
    P_API="$(env_get "$ENV_FILE" P_API)"
    if ! wait_api_health "$P_API" 120; then FAILED+=("$slug"); continue; fi
    # The api reads mail / Cloudinary / Google from its own IntegrationSettings
    # row, not from the environment, so the new values have to go in through the
    # CLI. Only non-empty ones are sent: a store's own edits are never blanked.
    INTEG="$(SLUG="$slug" "${PYTHON_BIN:-python3}" - <<'PY'
import json, os
def block(pairs):
    out = {k: v for k, v in pairs if v}
    return out or None
mail = block([("host", os.environ.get("MAIL_HOST")), ("port", os.environ.get("MAIL_PORT")),
              ("user", os.environ.get("MAIL_USER")), ("pass", os.environ.get("MAIL_PASS")),
              ("from", os.environ.get("MAIL_FROM"))])
cloud = block([("cloud_name", os.environ.get("CLOUDINARY_CLOUD_NAME")), ("api_key", os.environ.get("CLOUDINARY_API_KEY")),
               ("api_secret", os.environ.get("CLOUDINARY_API_SECRET")), ("root_folder", f"stores/{os.environ['SLUG']}"),
               ("max_file_size_mb", os.environ.get("MAX_IMAGE_MB"))])
google = block([("client_id", os.environ.get("GOOGLE_WEB_CLIENT_ID")), ("client_secret", os.environ.get("GOOGLE_CLIENT_SECRET"))])
print(json.dumps({k: v for k, v in (("mail", mail), ("cloudinary", cloud), ("google", google)) if v}, ensure_ascii=False))
PY
)"
    if [[ "$INTEG" != "{}" ]]; then
        if OUT="$(store_cli integrations --file - <<<"$INTEG")"; then log "$slug integrations: $OUT"; else warn "$slug: integrations push failed"; fi
    fi
    OK+=("$slug")
done
SUMMARY="⚙️ store config ($*): ok=${#OK[@]} failed=${#FAILED[@]}"
[[ ${#FAILED[@]} -gt 0 ]] && SUMMARY="$SUMMARY · failed: ${FAILED[*]}"
log "$SUMMARY"
telegram "$SUMMARY"
[[ ${#FAILED[@]} -eq 0 ]]
