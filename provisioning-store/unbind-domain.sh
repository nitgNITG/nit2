#!/usr/bin/env bash
# unbind-domain.sh <slug> — drop the custom domain: vhost + cert removed, store back on <slug>.<STORE_DOMAIN>.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
store_paths "${1:-}"
[[ -f "$ENV_FILE" ]] || die "store $SLUG not found"
STATUS="$CLIENT_DIR/domain-status.json"
TLS_MODE="${TLS_MODE:-per-host}"
SCHEME="https"; [[ "$TLS_MODE" == "none" ]] && SCHEME="http"

CUSTOM=""
[[ -f "$STATUS" ]] && CUSTOM="$(json_get "$(cat "$STATUS")" domain)"
if [[ -n "$CUSTOM" ]]; then
    log "removing $CUSTOM"
    bash "$SCRIPTS_DIR/proxy/proxy.sh" remove "$SLUG" "$CUSTOM" || warn "proxy removal failed for $CUSTOM"
fi
env_set "$ENV_FILE" PUBLIC_URL "$SCHEME://$HOST"
env_set "$ENV_FILE" API_PUBLIC_URL "$SCHEME://$HOST"
env_set "$ENV_FILE" DASHBOARD_URL "$SCHEME://$HOST/dashboard"
env_set "$ENV_FILE" ALLOWED_ORIGINS "$SCHEME://$HOST"
compose up -d >/dev/null 2>&1 || warn "compose up failed after unbind"
printf '{"state":"none","domain":"","error":"","at":%s}\n' "$(date +%s)" > "$STATUS"
report_done "$SCHEME://$HOST"
log "$SLUG back on $SCHEME://$HOST"
