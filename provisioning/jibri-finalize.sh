#!/usr/bin/env bash
# ============================================================================
#  jibri-finalize.sh — Jibri "finalize" script for the NIT SaaS.
#
#  Jibri runs this once a recording finishes, passing the recording directory:
#      finalize.sh <recording_dir>
#  (set FINALIZE_RECORDING_SCRIPT_PATH=/config/finalize.sh in the Jibri config,
#   and mount THIS file there).
#
#  What it does — multi-tenant safe:
#    1. Find the finished .mp4 and the room name (from metadata.json / filename).
#       Rooms are named  nit_<slug>_<cmid>_<hash>  by mod_jitsi (jitsi_room_name),
#       so <slug> tells us WHICH academy and <cmid> WHICH activity.
#    2. Upload the .mp4 straight to VdoCipher (S3 upload) → get a videoId.
#    3. POST that videoId to the owning academy:
#          https://<slug>.<SAAS_DOMAIN>/mod/jitsi/record_notify.php
#       with header  X-Notify-Key: <MOODLE_NOTIFY_KEY>.
#    4. Delete the local recording.
#
#  Env (put these in the Jibri container's environment):
#    VDOCIPHER_API_SECRET   VdoCipher API secret (same account as local_vdocipher)
#    VDOCIPHER_API          default https://dev.vdocipher.com/api
#    MOODLE_NOTIFY_KEY      shared secret = local_academysessions/jibri_notify_key
#    SAAS_DOMAIN            default academy2026.nitg-eg.com
#
#  Requires: curl, python3 (both already present in the Jibri image base or add them).
# ============================================================================
set -uo pipefail

RECDIR="${1:-}"
SAAS_DOMAIN="${SAAS_DOMAIN:-academy2026.nitg-eg.com}"
VDOCIPHER_API="${VDOCIPHER_API:-https://dev.vdocipher.com/api}"
VDOCIPHER_API_SECRET="${VDOCIPHER_API_SECRET:-}"
NOTIFY_KEY="${MOODLE_NOTIFY_KEY:-academy-cron-2024}"

log(){ echo "[finalize] $*" >&2; }
die(){ log "ERROR: $*"; exit 1; }

[ -n "$RECDIR" ] && [ -d "$RECDIR" ] || die "recording dir not found: '$RECDIR'"
[ -n "$VDOCIPHER_API_SECRET" ] || die "VDOCIPHER_API_SECRET not set"

MP4="$(find "$RECDIR" -maxdepth 2 -name '*.mp4' | head -1)"
[ -n "$MP4" ] || { log "no .mp4 in $RECDIR — nothing to do"; exit 0; }
log "recording: $MP4"

# ── Room → slug + cmid ───────────────────────────────────────────────────────
ROOM=""
if [ -f "$RECDIR/metadata.json" ]; then
    ROOM="$(grep -oE 'nit_[a-z0-9-]+_[0-9]+_[a-f0-9]+' "$RECDIR/metadata.json" | head -1)"
fi
[ -n "$ROOM" ] || ROOM="$(basename "$MP4" | grep -oE 'nit_[a-z0-9-]+_[0-9]+_[a-f0-9]+' | head -1)"
[ -n "$ROOM" ] || die "cannot determine room (expected nit_<slug>_<cmid>_<hash>)"

SLUG="$(printf '%s' "$ROOM" | sed -E 's/^nit_(.+)_([0-9]+)_[a-f0-9]+$/\1/')"
CMID="$(printf '%s' "$ROOM" | sed -E 's/^nit_(.+)_([0-9]+)_[a-f0-9]+$/\2/')"
[ -n "$SLUG" ] && [ -n "$CMID" ] || die "cannot parse slug/cmid from '$ROOM'"
TITLE="Recording $(date '+%Y-%m-%d %H:%M')"
log "academy=$SLUG cmid=$CMID"

# ── 1. VdoCipher: obtain upload credentials (returns videoId + S3 client payload) ──
TITLE_ENC="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$TITLE")"
CRED="$(curl -sf -X PUT "$VDOCIPHER_API/videos?title=$TITLE_ENC" \
    -H "Authorization: Apisecret $VDOCIPHER_API_SECRET")" || die "VdoCipher credential request failed"

# Parse the videoId + the S3 form fields with python3.
eval "$(printf '%s' "$CRED" | python3 - <<'PY'
import sys, json, shlex
d = json.load(sys.stdin)
cp = d.get("clientPayload", {})
def out(k, v): print(f'{k}={shlex.quote(str(v))}')
out("VIDEOID", d.get("videoId", ""))
out("UPLOAD_LINK", cp.get("uploadLink", ""))
out("POLICY", cp.get("policy", ""))
out("KEY", cp.get("key", ""))
out("SIG", cp.get("x-amz-signature", ""))
out("ALGO", cp.get("x-amz-algorithm", ""))
out("DATE", cp.get("x-amz-date", ""))
out("CREDENTIAL", cp.get("x-amz-credential", ""))
PY
)"
[ -n "${VIDEOID:-}" ] && [ -n "${UPLOAD_LINK:-}" ] || die "bad VdoCipher credential response: $CRED"
log "vdocipher videoId=$VIDEOID — uploading…"

# ── 2. Upload the file to VdoCipher's S3 (the "file" field MUST be last) ──────
HTTP="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$UPLOAD_LINK" \
    -F "x-amz-credential=$CREDENTIAL" \
    -F "x-amz-algorithm=$ALGO" \
    -F "x-amz-date=$DATE" \
    -F "x-amz-signature=$SIG" \
    -F "key=$KEY" \
    -F "policy=$POLICY" \
    -F "success_action_status=201" \
    -F "success_action_redirect=" \
    -F "file=@$MP4")" || die "S3 upload curl failed"
[ "$HTTP" = "201" ] || die "S3 upload returned HTTP $HTTP"
log "upload OK (VdoCipher will transcode asynchronously)"

# ── 3. Notify the owning academy ─────────────────────────────────────────────
NOTIFY_URL="https://${SLUG}.${SAAS_DOMAIN}/mod/jitsi/record_notify.php"
NHTTP="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$NOTIFY_URL" \
    -H "X-Notify-Key: $NOTIFY_KEY" \
    --data-urlencode "cmid=$CMID" \
    --data-urlencode "vdocipher_videoid=$VIDEOID" \
    --data-urlencode "title=$TITLE")" || log "notify curl failed"
if [ "${NHTTP:-}" -ge 200 ] 2>/dev/null && [ "${NHTTP:-}" -lt 300 ] 2>/dev/null; then
    log "notified $NOTIFY_URL (HTTP $NHTTP)"
else
    log "WARN: notify returned HTTP ${NHTTP:-?} — the video is in VdoCipher; re-notify if needed"
fi

# ── 4. Clean up local files ──────────────────────────────────────────────────
rm -rf "$RECDIR" && log "removed $RECDIR"
exit 0
