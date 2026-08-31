#!/usr/bin/env bash
# Run inside the CI job container. Never copy into a container-local web root.
set -euo pipefail
for name in SSH_HOST SSH_USER SSH_KEY SSH_KNOWN_HOSTS DEPLOY_TARGET_DIR; do
  if [[ -z "${!name:-}" ]]; then
    echo "Required deployment setting is missing: $name" >&2
    exit 1
  fi
done
SSH_PORT=${SSH_PORT:-22}
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Invalid SSH_HOST' >&2; exit 1; }
[[ "$SSH_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] || { echo 'Invalid SSH_USER' >&2; exit 1; }
[[ "$SSH_PORT" =~ ^[0-9]{1,5}$ ]] && ((10#$SSH_PORT > 0 && 10#$SSH_PORT <= 65535)) || { echo 'Invalid SSH_PORT' >&2; exit 1; }
[[ "$DEPLOY_TARGET_DIR" =~ ^/[a-zA-Z0-9_/-]+$ && "$DEPLOY_TARGET_DIR" != / ]] || { echo 'Invalid DEPLOY_TARGET_DIR' >&2; exit 1; }
for tool in ssh tar python3; do
  command -v "$tool" >/dev/null || { echo "Runner job image must provide $tool" >&2; exit 1; }
done
[[ -f dist/latest/version.json && -d dist/releases ]] || { echo 'Build output is missing' >&2; exit 1; }
umask 077
credentials=$(mktemp -d)
stage=''
remote="${SSH_USER}@${SSH_HOST}"
ssh_args=(-p "$SSH_PORT" -i "$credentials/key" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$credentials/known_hosts" -o ConnectTimeout=15
  -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
cleanup() {
  if [[ -n "$stage" ]]; then
    ssh "${ssh_args[@]}" "$remote" "rm -rf -- '$stage'" </dev/null || true
  fi
  rm -rf -- "$credentials"
}
trap cleanup EXIT
printf '%s\n' "$SSH_KEY" > "$credentials/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$credentials/known_hosts"
unset SSH_KEY SSH_KNOWN_HOSTS
# The administrator must prepare the actual Nginx directory and grant write access.
stage=$(ssh "${ssh_args[@]}" "$remote" "test -d '$DEPLOY_TARGET_DIR' && test -w '$DEPLOY_TARGET_DIR' && command -v python3 >/dev/null && mktemp -d '$DEPLOY_TARGET_DIR/.upload-XXXXXXXXXX'")
if [[ ! "$stage" =~ ^${DEPLOY_TARGET_DIR}/\.upload-[a-zA-Z0-9]+$ ]]; then
  stage=''
  echo 'Remote staging directory validation failed' >&2
  exit 1
fi
# Fix public artifact permissions independently of the runner's umask.
tar -czf - -C dist . | ssh "${ssh_args[@]}" "$remote" "tar -xzf - -C '$stage' && chmod -R a+rX '$stage'"
ssh "${ssh_args[@]}" "$remote" "python3 - '$stage' '$DEPLOY_TARGET_DIR'" < deploy/publish.py
