#!/usr/bin/env bash
# ============================================================================
#  build-image.sh — build the baked SaaS Moodle image on server B from a CLEAN
#  saas-demo checkout (NOT the messy working folder). Run on the box that runs
#  the academy containers.
#
#  Usage:
#    export GITHUB_TOKEN=ghp_xxxx        # to clone the private saas-demo
#    bash build-image.sh [branch] [tag]
#      branch  default: main
#      tag     default: saas-moodle:YYYY.MM.DD   (also tagged saas-moodle:latest)
#
#  Result: image saas-moodle:<tag> with the code baked in, ready for create.sh
#          (SAAS_IMAGE=saas-moodle:<tag>).
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_OWNER="${REPO_OWNER:-NITGg}"
REPO_NAME="${REPO_NAME:-saas-demo}"
BASE_IMAGE="${BASE_IMAGE:-moodle-new:latest}"
BRANCH="${1:-main}"
TAG="${2:-saas-moodle:$(date +%Y.%m.%d)}"

log(){ echo "==> $*"; }

# The base must exist — we layer the code on top of it, we don't rebuild it.
docker image inspect "$BASE_IMAGE" >/dev/null 2>&1 \
    || { echo "ERROR: base image $BASE_IMAGE not found on this host."; exit 1; }

BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"
else
    URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
fi

log "cloning ${REPO_NAME}@${BRANCH} (shallow) into a clean build context"
git clone --depth 1 --branch "$BRANCH" "$URL" "$BUILD_DIR/code"

# The Dockerfile + .dockerignore travel with THIS repo, not saas-demo.
cp "$HERE/Dockerfile"    "$BUILD_DIR/code/Dockerfile.saas"
cp "$HERE/.dockerignore" "$BUILD_DIR/code/.dockerignore"

log "building $TAG  (base=$BASE_IMAGE)"
docker build \
    --build-arg "BASE_IMAGE=$BASE_IMAGE" \
    -f "$BUILD_DIR/code/Dockerfile.saas" \
    -t "$TAG" \
    "$BUILD_DIR/code"

docker tag "$TAG" saas-moodle:latest

log "built $TAG  (also tagged saas-moodle:latest)"
log "next: run a client with  SAAS_IMAGE=$TAG bash create.sh <slug> \"<name>\""
