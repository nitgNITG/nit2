#!/usr/bin/env bash
# ============================================================================
#  lib.sh — helpers shared by every provisioning-store script. Source it:
#      source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
#
#  Provides: log/die, the per-store paths (store_paths <slug>), free-port
#  allocation, health waiting, the compose wrapper, the CLI wrapper, JSON
#  helpers (python3, no jq dependency) and the progress reporter that feeds
#  provision-server.py → nit2 ("Starting containers (6/12)").
# ============================================================================

STORE_ROOT="${STORE_ROOT:-/var/www/html/saas-stores}"
STORE_DOMAIN="${STORE_DOMAIN:-commerce.nitg-eg.com}"
PROVISION_PORT="${PROVISION_PORT:-9098}"
SCRIPTS_DIR="${SCRIPTS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
SLUG_RE='^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
PY="${PYTHON_BIN:-python3}"   # stdlib only; override on dev boxes without a python3 alias

log(){ echo "==> $*"; }
warn(){ echo "!! $*" >&2; }
die(){ echo "ERROR: $*" >&2; exit 1; }

# ── Per-store paths / names ───────────────────────────────────────────────────
store_paths(){ # $1=slug → exports the variables every script needs
    SLUG="$1"
    [[ "$SLUG" =~ $SLUG_RE ]] || die "Invalid slug '$SLUG' (lowercase letters/digits/hyphens, 3-40)."
    PROJECT="store_${SLUG//-/_}"
    HOST="${SLUG}.${STORE_DOMAIN}"
    CLIENT_DIR="$STORE_ROOT/clients/$SLUG"
    ENV_FILE="$CLIENT_DIR/store.env"
    COMPOSE_FILE="$CLIENT_DIR/compose.yml"
    DB_NAME="store_${SLUG//-/_}"
    DB_USER="$DB_NAME"
    export SLUG PROJECT HOST CLIENT_DIR ENV_FILE COMPOSE_FILE DB_NAME DB_USER
}

# Read one KEY from a store.env (or any KEY=value file).
env_get(){ # $1=file $2=key
    [[ -f "$1" ]] && sed -n "s/^$2=//p" "$1" | tail -1 || true
}
# Set KEY=value in a store.env in place (adds it when missing).
env_set(){ # $1=file $2=key $3=value
    if grep -q "^$2=" "$1" 2>/dev/null; then
        sed -i "s|^$2=.*|$2=$3|" "$1"
    else
        printf '%s=%s\n' "$2" "$3" >> "$1"
    fi
}

# ── docker compose for one store (always -p <project>, always --env-file) ────
# The service runs with EnvironmentFile=provision.env, so IMAGE_TAG, REGISTRY and
# the *_MEM limits are already in our process environment — and compose gives the
# SHELL environment precedence over --env-file. That silently pinned every store
# to the host's tag: rollouts rewrote the store's IMAGE_TAG, compose ignored it
# and kept recreating the old image. Unset the keys each store owns so the
# store.env values are the ones that count.
STORE_OWNED_ENV=(IMAGE_TAG REGISTRY API_MEM SITE_MEM DASH_MEM API_CPUS SITE_CPUS DASH_CPUS
                 P_SITE P_DASH P_API STORE_SLUG PUBLIC_URL API_PREFIX)
compose(){ # compose <slug-already-set> args...
    local unset_args=() k
    for k in "${STORE_OWNED_ENV[@]}"; do unset_args+=(-u "$k"); done
    env "${unset_args[@]}" docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# Run the store-api CLI inside the store's api container; stdin is passed through
# so JSON can be piped (`--file -`). Prints the CLI's one JSON line.
store_cli(){ # store_cli <cli args...>
    compose exec -T api node dist/cli.js "$@"
}

# ── JSON helpers (python3 is always present on the host) ─────────────────────
json_get(){ # json_get '<json>' key[.sub]  → value or empty (objects/lists as JSON)
    J="$1" K="$2" "$PY" - <<'PY' 2>/dev/null || true
import json, os
data = json.loads(os.environ["J"] or "null")
for part in os.environ["K"].split("."):
    data = data.get(part) if isinstance(data, dict) else None
if data is None:
    print("")
elif isinstance(data, (dict, list)):
    print(json.dumps(data, ensure_ascii=False))
else:
    print(data)
PY
}
json_escape(){ J="$1" "$PY" -c 'import json,os; print(json.dumps(os.environ["J"], ensure_ascii=False))'; }

# ── Ports: 3 consecutive free host ports per store (site, dash, api) ─────────
port_in_use(){ # $1=port → 0 when something listens or a store.env already claims it
    ss -ltnH "sport = :$1" 2>/dev/null | grep -q . && return 0
    grep -rqs "^P_\(SITE\|DASH\|API\)=$1$" "$STORE_ROOT"/clients/*/store.env 2>/dev/null
}
alloc_ports(){ # → exports P_SITE P_DASH P_API
    local base="${PORT_BASE:-9100}" p
    for ((p=base; p<base+3000; p+=3)); do
        if ! port_in_use "$p" && ! port_in_use "$((p+1))" && ! port_in_use "$((p+2))"; then
            P_SITE=$p; P_DASH=$((p+1)); P_API=$((p+2))
            export P_SITE P_DASH P_API
            return 0
        fi
    done
    die "no free port triplet from $base"
}

# ── Health: poll the api on its host port until /health answers 200 ─────────
wait_api_health(){ # $1=api host port  $2=timeout seconds
    local port="$1" timeout="${2:-90}" i
    for ((i=0; i<timeout*2; i++)); do
        if curl -sf "http://127.0.0.1:${port}${API_PREFIX:-/apis/v1}/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 0.5
    done
    return 1
}

# ── Progress reporting → provision-server.py (persists + forwards to nit2) ───
# report_step N TOTAL "label"      running
# report_done "url" [extra-json]   done
# report_failed "message"          failed
_report(){ # $1=json body
    [[ -n "${STORE_JOB:-}" ]] || return 0   # not running under the service (manual run)
    curl -sS -m 3 -o /dev/null -X POST "http://127.0.0.1:${PROVISION_PORT}/_progress/${SLUG}" \
        -H "X-Provision-Secret: ${PROVISION_SECRET:-}" -H "Content-Type: application/json" \
        -d "$1" 2>/dev/null || true
}
report_step(){ # N TOTAL label
    LAST_STEP="$3"; log "[$1/$2] $3"
    _report "{\"job\":${STORE_JOB:-0},\"state\":\"running\",\"step\":$1,\"total\":$2,\"label\":$(json_escape "$3")}"
}
report_done(){ # url [extra json object fields, e.g. '"image_tag":"1.2.3"']
    local extra="${2:-}"
    _report "{\"job\":${STORE_JOB:-0},\"state\":\"done\",\"url\":$(json_escape "$1")${extra:+,$extra}}"
}
report_failed(){ # message
    _report "{\"job\":${STORE_JOB:-0},\"state\":\"failed\",\"error\":$(json_escape "$1")}"
}
# Call `trap 'on_error' ERR` in scripts that run under set -e: reports the
# failing line so nit2 shows a reason instead of "stuck".
on_error(){
    local rc=$? line="${BASH_LINENO[0]}"
    report_failed "step failed (exit $rc at line $line): ${LAST_STEP:-?}"
    exit "$rc"
}

# ── Telegram (optional) ──────────────────────────────────────────────────────
telegram(){ # $1=text
    [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]] || return 0
    curl -fsS -m 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=$1" >/dev/null 2>&1 \
        || warn "telegram ping failed"
}
