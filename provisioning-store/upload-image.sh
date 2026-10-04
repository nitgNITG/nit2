#!/usr/bin/env bash
# ============================================================================
#  upload-image.sh — signed upload of one image to the platform Cloudinary.
#      bash upload-image.sh <file> <folder> <public_id>   → prints secure_url
#  Env: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
#  Used for a store's logo at creation (the api serves images from Cloudinary).
# ============================================================================
set -euo pipefail
FILE="${1:-}"; FOLDER="${2:-}"; PUBLIC_ID="${3:-}"
[[ -f "$FILE" && -n "$FOLDER" && -n "$PUBLIC_ID" ]] || { echo "usage: upload-image.sh <file> <folder> <public_id>" >&2; exit 1; }
: "${CLOUDINARY_CLOUD_NAME:?}" "${CLOUDINARY_API_KEY:?}" "${CLOUDINARY_API_SECRET:?}"

TS="$(date +%s)"
# Signature = sha1 of the alphabetically sorted params + the API secret.
SIG="$(printf 'folder=%s&overwrite=true&public_id=%s&timestamp=%s%s' "$FOLDER" "$PUBLIC_ID" "$TS" "$CLOUDINARY_API_SECRET" | sha1sum | cut -d' ' -f1)"
RESP="$(curl -sS -m 60 -F "file=@$FILE" -F "api_key=$CLOUDINARY_API_KEY" -F "timestamp=$TS" \
    -F "folder=$FOLDER" -F "public_id=$PUBLIC_ID" -F "overwrite=true" -F "signature=$SIG" \
    "https://api.cloudinary.com/v1_1/$CLOUDINARY_CLOUD_NAME/image/upload")"
URL="$(J="$RESP" "${PYTHON_BIN:-python3}" -c 'import json,os; print(json.loads(os.environ["J"]).get("secure_url",""))' 2>/dev/null || true)"
[[ -n "$URL" ]] || { echo "cloudinary upload failed: $RESP" >&2; exit 1; }
echo "$URL"
