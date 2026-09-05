#!/usr/bin/env bash
# ============================================================================
#  apply-integrations.sh <slug> — push the shared platform integration creds
#  (Kashier / VDOCipher / Vimeo) into an academy's Moodle plugin config, from env
#  vars supplied by the nit2 provisioner. Only sets a value when its env var is
#  non-empty, so a missing secret never blanks existing config. Whitelisted to the
#  three integration plugins — no arbitrary config keys are written here.
#
#  Called by create.sh (after the container is up) and by the /apply-integrations
#  endpoint on a tier / licence change.
#
#  Env (all optional):
#    KASHIER_ENABLED=1  KASHIER_MERCHANT_ID  KASHIER_API_KEY  KASHIER_SECRET_KEY
#                       KASHIER_SANDBOX      KASHIER_BASE_URL
#    VDOCIPHER_APISECRET  VDOCIPHER_APIBASE
#    VIMEO_ACCESS_TOKEN   VIMEO_APIBASE  VIMEO_CLIENT_ID  VIMEO_CLIENT_SECRET
# ============================================================================
set -uo pipefail

log(){ echo "==> $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "Usage: bash apply-integrations.sh <slug>"
[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$ ]] || die "invalid slug"

CONTAINER="saas_moodle_${SLUG}"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container $CONTAINER is not running"

# Set one plugin config value, but only when non-empty. A plugin that isn't
# installed yet (e.g. local_vimeo before it's built) just fails softly.
_set(){ # $1=component $2=name $3=value
    [[ -n "$3" ]] || return 0
    docker exec "$CONTAINER" php /var/www/html/admin/cli/cfg.php --component="$1" --name="$2" --set="$3" >/dev/null 2>&1 \
        && log "set $1/$2" || echo "!! could not set $1/$2 (plugin missing?)"
}

# ── Kashier (payments) ───────────────────────────────────────────────────────
if [[ "${KASHIER_ENABLED:-0}" == "1" ]]; then
    _set paymentprovider_kashier merchant_id  "${KASHIER_MERCHANT_ID:-}"
    _set paymentprovider_kashier api_key      "${KASHIER_API_KEY:-}"
    _set paymentprovider_kashier secret_key   "${KASHIER_SECRET_KEY:-}"
    _set paymentprovider_kashier sandbox_mode "${KASHIER_SANDBOX:-}"
    _set paymentprovider_kashier base_url     "${KASHIER_BASE_URL:-}"
fi

# ── VDOCipher (video DRM) ────────────────────────────────────────────────────
_set local_vdocipher apisecret "${VDOCIPHER_APISECRET:-}"
_set local_vdocipher apibase   "${VDOCIPHER_APIBASE:-}"

# ── Vimeo (video) ────────────────────────────────────────────────────────────
_set local_vimeo access_token  "${VIMEO_ACCESS_TOKEN:-}"
_set local_vimeo apibase       "${VIMEO_APIBASE:-}"
_set local_vimeo client_id     "${VIMEO_CLIENT_ID:-}"
_set local_vimeo client_secret "${VIMEO_CLIENT_SECRET:-}"

docker exec "$CONTAINER" php /var/www/html/admin/cli/purge_caches.php >/dev/null 2>&1 || true
log "integrations applied for $SLUG"
