#!/usr/bin/env bash
# ============================================================================
#  bind-domain.sh <slug> <domain> — make a merchant's own domain the store's
#  canonical URL: vhost + certbot for <domain>, PUBLIC_URL rewritten in
#  store.env, containers recreated (env changed → all three restart, ~5 s).
#  The <slug>.<STORE_DOMAIN> host keeps working. DNS must already point
#  <domain> at this host (checked here; certbot's HTTP-01 re-checks).
#  Outcome → clients/<slug>/domain-status.json  {state: verifying|active|failed}
# ============================================================================
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
CUSTOM="${2:-}"
[[ "$CUSTOM" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || die "invalid domain '$CUSTOM'"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found"
STATUS="$CLIENT_DIR/domain-status.json"
TLS_MODE="${TLS_MODE:-per-host}"
SCHEME="https"; [[ "$TLS_MODE" == "none" ]] && SCHEME="http"

write_status(){ # state error
    printf '{"state":"%s","domain":"%s","error":%s,"at":%s}\n' "$1" "$CUSTOM" "$(json_escape "${2:-}")" "$(date +%s)" > "$STATUS"
}
fail(){ write_status failed "$*"; report_failed "$*"; die "$*"; }

TOTAL=4
write_status verifying ""
report_step 1 $TOTAL "Checking DNS for $CUSTOM"
MY_IP="$(curl -s -m 5 https://api.ipify.org || hostname -I | awk '{print $1}')"
RESOLVED="$(getent ahostsv4 "$CUSTOM" | awk '{print $1}' | sort -u | tr '\n' ' ')"
[[ " $RESOLVED " == *" $MY_IP "* ]] || fail "$CUSTOM resolves to '${RESOLVED:-nothing}', not this host ($MY_IP)"

report_step 2 $TOTAL "Publishing $CUSTOM"
P_SITE="$(env_get "$ENV_FILE" P_SITE)"; P_DASH="$(env_get "$ENV_FILE" P_DASH)"; P_API="$(env_get "$ENV_FILE" P_API)"
bash "$SCRIPTS_DIR/proxy/proxy.sh" add "$SLUG" "$CUSTOM" "$P_SITE" "$P_DASH" "$P_API" || fail "proxy/certbot failed for $CUSTOM"

report_step 3 $TOTAL "Switching the store to $CUSTOM"
env_set "$ENV_FILE" PUBLIC_URL "$SCHEME://$CUSTOM"
env_set "$ENV_FILE" API_PUBLIC_URL "$SCHEME://$CUSTOM"
env_set "$ENV_FILE" DASHBOARD_URL "$SCHEME://$CUSTOM/dashboard"
env_set "$ENV_FILE" ALLOWED_ORIGINS "$SCHEME://$CUSTOM,$SCHEME://$HOST"
compose up -d >/dev/null 2>&1 || fail "compose up failed after domain switch"
wait_api_health "$P_API" 90 || fail "api not healthy after domain switch"

report_step 4 $TOTAL "Active"
write_status active ""
report_done "$SCHEME://$CUSTOM" "\"domain\":$(json_escape "$CUSTOM")"
log "$SLUG now canonical at $SCHEME://$CUSTOM"
