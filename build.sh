#!/bin/bash
set -e

echo "==> 1. 构建 Web 前端产物..."
cd web && npm run build
cd ..

echo "==> 2. 编译 Go 单二进制程序 (内嵌前端静态文件)..."
go build -o jira main.go

echo "✓ 构建成功！单二进制文件: ./jira"
