#!/usr/bin/env bash
# Gitea job container: the host publish directory must be an explicit bind mount.
set -euo pipefail
: "${DEPLOY_TARGET_DIR:?DEPLOY_TARGET_DIR is required}"
mountpoint -q "$DEPLOY_TARGET_DIR" || { echo 'Publish directory is not a mount point; refusing container-local deployment' >&2; exit 1; }
[[ -d "$DEPLOY_TARGET_DIR" && -w "$DEPLOY_TARGET_DIR" ]] || { echo 'Publish directory is not writable' >&2; exit 1; }
[[ -f dist/latest/version.json && -d dist/releases ]] || { echo 'Build output is missing' >&2; exit 1; }
umask 022
# Stage on the target filesystem so the final version directory can be renamed atomically.
stage=$(mktemp -d "$DEPLOY_TARGET_DIR/.upload-XXXXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
cp -a dist/. "$stage/"
chmod -R a+rX "$stage"
python3 deploy/publish.py "$stage" "$DEPLOY_TARGET_DIR"
