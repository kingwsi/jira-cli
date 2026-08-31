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
install_dir="${HOME:?未设置 HOME，无法确定用户安装目录}/.local/bin"
mkdir -p "$install_dir"
install -m 0755 "$work/jira" "$install_dir/jira"
printf '安装成功：%s，位置：%s/jira。\n' "$VERSION" "$install_dir"
case ":${PATH:-}:" in
  *":$install_dir:"*) ;;
  *)
    printf '请将以下配置加入 shell 配置文件（如 ~/.zshrc 或 ~/.bashrc），并在当前终端执行：\n'
    printf 'export PATH="$HOME/.local/bin:$PATH"\n'
    ;;
esac
printf '启动工作台："%s/jira" -open\n' "$install_dir"
