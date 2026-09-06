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

# Enable/disable a local_payments provider ROW (separate from its credentials —
# checkout only considers enabled providers). Soft-fails if local_payments or the
# provider isn't there. Requires /root/enable_payment_provider.php on the server.
_set_provider(){ # $1=provider name $2=1|0
    [[ -f /root/enable_payment_provider.php ]] || { echo "!! enable_payment_provider.php not installed — cannot toggle $1"; return 0; }
    docker cp /root/enable_payment_provider.php "$CONTAINER:/var/www/moodledata/enable_payment_provider.php" >/dev/null 2>&1
    docker exec -e PP_PROVIDER="$1" -e PP_ENABLED="$2" \
        "$CONTAINER" php /var/www/moodledata/enable_payment_provider.php >/dev/null 2>&1 \
        && log "provider $1 enabled=$2" || echo "!! could not set provider $1 enabled=$2"
    docker exec "$CONTAINER" rm -f /var/www/moodledata/enable_payment_provider.php >/dev/null 2>&1 || true
}

# ── Kashier (payments) ───────────────────────────────────────────────────────
if [[ "${KASHIER_ENABLED:-0}" == "1" ]]; then
    _set paymentprovider_kashier merchant_id  "${KASHIER_MERCHANT_ID:-}"
    _set paymentprovider_kashier api_key      "${KASHIER_API_KEY:-}"
    _set paymentprovider_kashier secret_key   "${KASHIER_SECRET_KEY:-}"
    _set paymentprovider_kashier sandbox_mode "${KASHIER_SANDBOX:-}"
    _set paymentprovider_kashier base_url     "${KASHIER_BASE_URL:-}"
fi
# Track the Kashier PROVIDER's enabled state to the licence, independent of the
# creds above: on when the package includes Kashier, off otherwise (the licence,
# not a manual toggle, governs). KASHIER_ENABLED is absent for non-Kashier
# packages, so it defaults to 0 = disabled — that's what disables it on downgrade.
_set_provider kashier "${KASHIER_ENABLED:-0}"

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
