#!/usr/bin/env bash
set -euo pipefail
VERSION="__VERSION__"
BASE_URL="https://nextx.uk/jira-work/releases/${VERSION}"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
esac
case "${OS}/${ARCH}" in
  darwin/arm64|darwin/amd64|linux/amd64) ;;
  mingw*|msys*|cygwin*)
    echo 'Windows 请从下载页下载 Windows 包，解压后运行 jira.exe；此脚本仅支持 macOS/Linux。' >&2
    exit 1 ;;
  *) echo "暂不提供 ${OS}/${ARCH} 的安装包，请查看下载页。" >&2; exit 1 ;;
esac
TAR_FILE="jira-${OS}-${ARCH}.tar.gz"
case "$TAR_FILE" in
__CHECKSUM_CASES__
  *) echo '缺少发布包校验值' >&2; exit 1 ;;
esac
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
printf '正在下载 Jira Workbench %s (%s/%s)...\n' "$VERSION" "$OS" "$ARCH"
curl -fsSL "${BASE_URL}/${TAR_FILE}" -o "$work/package.tar.gz"
if command -v sha256sum >/dev/null; then
  actual=$(sha256sum "$work/package.tar.gz")
else
  actual=$(shasum -a 256 "$work/package.tar.gz")
fi
[[ "${actual%% *}" == "$expected" ]] || { echo '下载包校验失败，未安装。' >&2; exit 1; }
tar -xzf "$work/package.tar.gz" -C "$work" jira
[[ -f "$work/jira" && ! -L "$work/jira" ]] || { echo '发布包缺少有效的 jira 程序' >&2; exit 1; }
if [[ $(id -u) == 0 ]]; then
  mkdir -p /usr/local/bin
  install -m 0755 "$work/jira" /usr/local/bin/jira
else
  sudo mkdir -p /usr/local/bin
  sudo install -m 0755 "$work/jira" /usr/local/bin/jira
fi
printf "安装成功：%s。输入 'jira -open' 启动工作台。\n" "$VERSION"
