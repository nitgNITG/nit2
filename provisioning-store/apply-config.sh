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
    if wait_api_health "$P_API" 120; then OK+=("$slug"); else FAILED+=("$slug"); fi
done
SUMMARY="⚙️ store config ($*): ok=${#OK[@]} failed=${#FAILED[@]}"
[[ ${#FAILED[@]} -gt 0 ]] && SUMMARY="$SUMMARY · failed: ${FAILED[*]}"
log "$SUMMARY"
telegram "$SUMMARY"
[[ ${#FAILED[@]} -eq 0 ]]
