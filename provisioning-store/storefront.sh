#!/usr/bin/env bash
# ============================================================================
#  storefront.sh <slug> open|close|status — show or hide the public website of
#  one store. The API, the dashboard and the mobile app keep working either way.
#  Run as root over SSH, or from nit2 (Dashboard → Stores → Open/Close website).
#
#    close   /            → 302 /dashboard
#            /pages/...   → still the website (legal pages for the app stores)
#            /_next/...   → still the website (assets of those pages)
#            anything else → dashboard
#    open    /            → website, /dashboard → dashboard (the normal layout)
#
#  Only the location blocks of the store's first server block are rewritten, so
#  Certbot's listen / ssl_* lines and its port 80 redirect stay as they are. The
#  files are backed up first, and put back if `nginx -t` refuses the new ones.
#  nginx is reloaded, never restarted, so other stores on the host don't blink.
#
#  The containers are not stopped: the site container serves /pages/ while the
#  store is closed. Closed survives image updates (they don't touch nginx). A
#  domain bound later starts open; run `close` again to cover it.
# ============================================================================
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
USAGE="usage: storefront.sh <slug> open|close|status"
[[ -n "${1:-}" ]] || die "$USAGE"
store_paths "$1"
ACTION="${2:-}"
[[ "$ACTION" =~ ^(open|close|status)$ ]] || die "$USAGE"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found ($ENV_FILE)"

P_SITE="$(env_get "$ENV_FILE" P_SITE)"; P_DASH="$(env_get "$ENV_FILE" P_DASH)"; P_API="$(env_get "$ENV_FILE" P_API)"
[[ -n "$P_SITE" && -n "$P_DASH" && -n "$P_API" ]] || die "ports are missing from $ENV_FILE"
export P_SITE P_DASH P_API

CONF_DIR="${NGINX_CONF_DIR:-/etc/nginx/conf.d}"
BACKUP_ROOT="${NGINX_BACKUP_DIR:-/var/backups/saas-store-nginx}"

# Every host of this store (its own and any bound domain) proxies to its API port.
mapfile -t CONFS < <(grep -ls "127.0.0.1:${P_API};" "$CONF_DIR"/saas-store-*.conf || true)
[[ ${#CONFS[@]} -gt 0 ]] || die "no nginx file for $SLUG in $CONF_DIR (PROXY=apache or none is not supported here)"

is_closed(){ # $1=conf
    grep -Eq '^[[:space:]]*location[[:space:]]*=[[:space:]]*/[[:space:]]*\{[[:space:]]*return[[:space:]]+302[[:space:]]+/dashboard;' "$1"
}
host_of(){ # $1=conf
    local name; name="$(basename "$1" .conf)"
    printf '%s' "${name#saas-store-}"
}
site_answers(){
    [[ "$(curl -s -o /dev/null -m 3 -w '%{http_code}' "http://127.0.0.1:${P_SITE}/" || true)" =~ ^[1-4] ]]
}
fetch(){ # $1=conf $2=path → "<code> <redirect url>" through nginx, as a visitor gets it
    local host; host="$(host_of "$1")"
    if grep -q 'listen.*443' "$1"; then
        curl -sk -o /dev/null -m 10 -w '%{http_code} %{redirect_url}' --resolve "$host:443:127.0.0.1" "https://$host$2" || true
    else
        curl -s -o /dev/null -m 10 -w '%{http_code} %{redirect_url}' --resolve "$host:80:127.0.0.1" "http://$host$2" || true
    fi
}

rewrite(){ # $1=closed|open $2=conf in $3=conf out
    "$PY" - "$1" "$2" "$3" <<'PY'
import os, re, sys
want, src, dst = sys.argv[1:4]
site, dash, api = os.environ["P_SITE"], os.environ["P_DASH"], os.environ["P_API"]

def proxy(match, port, upgrade=False, timeout=None):
    out = [
        "    location %s {" % match,
        "        proxy_pass http://127.0.0.1:%s;" % port,
        "        proxy_http_version 1.1;",
        "        proxy_set_header Host $host;",
        "        proxy_set_header X-Forwarded-Proto $scheme;",
        "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    ]
    if upgrade:
        out += ["        proxy_set_header Upgrade $http_upgrade;",
                '        proxy_set_header Connection "upgrade";']
    if timeout:
        out.append("        proxy_read_timeout %s;" % timeout)
    return out + ["    }"]

routes = ["    # storefront: %s (set by storefront.sh)" % want]
routes += proxy("/apis/", api, timeout="120s")
if want == "closed":
    routes += proxy("~ ^/(en|ar|fr)?/?pages/", site, upgrade=True)
    routes += proxy("/_next/", site)
    routes += ["    location = / { return 302 /dashboard; }"]
    routes += proxy("/", dash, upgrade=True)
else:
    routes += proxy("/dashboard", dash, upgrade=True)
    routes += proxy("/", site, upgrade=True)

with open(src, encoding="utf-8", newline="") as f:
    lines = f.read().split("\n")

start = next((i for i, l in enumerate(lines) if re.match(r"\s*server\s*\{", l)), None)
if start is None:
    sys.exit("no server block in " + src)

kept, end, depth, in_location, opened = [], None, 1, False, False
for i in range(start + 1, len(lines)):
    code = lines[i].split("#", 1)[0].strip()
    if not in_location:
        if code == "}":
            end = i
            break
        if not code:
            continue  # blank lines and comments, including commented-out locations
        if not re.match(r"location\b", code):
            if "{" in code or "}" in code:
                sys.exit("unexpected block in %s: %s (edit this file by hand)" % (src, code))
            kept.append(lines[i])
            continue
        in_location, opened, depth = True, False, 1
    depth += code.count("{") - code.count("}")
    opened = opened or "{" in code
    if opened and depth == 1:
        in_location = False
if end is None:
    sys.exit("unbalanced braces in " + src)

anchors = [i for i, l in enumerate(kept) if re.match(r"\s*(client_max_body_size|server_name)\b", l)]
if not anchors:
    sys.exit("no server_name in the first server block of " + src)
cut = anchors[-1] + 1

result = lines[:start + 1] + kept[:cut] + [""] + routes + [""] + kept[cut:] + lines[end:]
with open(dst, "w", encoding="utf-8", newline="") as f:
    f.write("\n".join(result))
PY
}

show_status(){
    local conf
    for conf in "${CONFS[@]}"; do
        if is_closed "$conf"; then
            echo "  $(host_of "$conf"): CLOSED (the home page goes to the dashboard)"
        else
            echo "  $(host_of "$conf"): OPEN"
        fi
    done
    if site_answers; then
        echo "  site container: answering on port $P_SITE"
    else
        echo "  site container: NOT answering on port $P_SITE"
    fi
}

if [[ "$ACTION" == "status" ]]; then
    log "storefront of $SLUG"
    show_status
    exit 0
fi

if [[ "$ACTION" == "close" ]]; then WANT=closed; else WANT=open; fi

# The dashboard button and SSH can both run this: one at a time per store.
[[ -w "$CLIENT_DIR" ]] || die "run this as root (sudo)"
exec 9>"$CLIENT_DIR/.storefront.lock"
flock -n 9 || die "already running for $SLUG; try again in a minute"

TODO=()
for conf in "${CONFS[@]}"; do
    if is_closed "$conf"; then state=closed; else state=open; fi
    [[ "$state" == "$WANT" ]] || TODO+=("$conf")
done

# Bring the website up before sending customers to it, so they never see a 502.
if [[ "$ACTION" == "open" ]]; then
    if ! site_answers; then
        log "starting the site container"
        compose up -d --no-deps site
        for _ in $(seq 1 30); do site_answers && break; sleep 1; done
        site_answers || die "the site container is not answering on port $P_SITE; nginx was left as it is"
    fi
fi

if [[ ${#TODO[@]} -eq 0 ]]; then
    log "$SLUG is already ${WANT}; nothing to change"
else
    STAMP="$(date +%Y%m%d-%H%M%S)"
    BACKUP_DIR="$BACKUP_ROOT/$SLUG/$STAMP"
    WORK="$BACKUP_DIR/new"
    mkdir -p "$WORK"
    for conf in "${TODO[@]}"; do
        cp -p "$conf" "$BACKUP_DIR/$(basename "$conf")"
        rewrite "$WANT" "$conf" "$WORK/$(basename "$conf")"
    done

    restore(){
        local c
        for c in "${TODO[@]}"; do cat "$BACKUP_DIR/$(basename "$c")" > "$c"; done
    }
    for conf in "${TODO[@]}"; do cat "$WORK/$(basename "$conf")" > "$conf"; done
    if ! nginx -t; then
        restore
        die "nginx refused the new config; the old files are back in place and nothing was reloaded"
    fi
    systemctl reload nginx
    rm -rf "$WORK"
    log "$SLUG is now $WANT (backup: $BACKUP_DIR)"
fi

# Check it the way a visitor would.
sleep 1
FAILED=0
for conf in "${CONFS[@]}"; do
    home="$(fetch "$conf" /)"; api="$(fetch "$conf" /apis/v1/health)"; dash="$(fetch "$conf" /dashboard/login)"
    echo "  $(host_of "$conf"):  home=$home  api=$api  dashboard=$dash"
    if [[ "$WANT" == "closed" ]]; then
        [[ "$home" == 302*/dashboard ]] || { warn "home page should redirect to /dashboard"; FAILED=1; }
    else
        [[ "$home" =~ ^[1-4] && "$home" != */dashboard ]] || { warn "home page should show the website"; FAILED=1; }
    fi
    [[ "$api" == 200* ]] || { warn "the API is not answering 200"; FAILED=1; }
    [[ "$dash" =~ ^[23] ]] || { warn "the dashboard is not answering"; FAILED=1; }
done
if [[ "$WANT" == "closed" ]] && ! site_answers; then
    warn "the site container is down, so /pages/ (legal pages) won't load until it is started"
fi
[[ $FAILED -eq 0 ]] || die "nginx was reloaded, but the checks above failed"
log "checks passed"
