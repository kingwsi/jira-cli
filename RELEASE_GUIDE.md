# Jira Workbench 版本发布指南 (Release Guide)

本文档面向开发者和自动化 Agent，详细说明如何为 **Jira Workbench** 规范化发布新版本、触发持续集成编译和发布。

---

## 🚀 极简发布步骤 (Quick Reference)

```bash
# 1. 编译前端（生成嵌入 Go 二进制的静态资源）
cd web && npm run build && cd ..

# 2. 运行后端测试与验证
go test ./...
go build -o /dev/null .

# 3. 提交代码变动
git add .
git commit -m "feat: <更新内容摘要>"

# 4. 查看当前最新版本并创建新 Tag (遵循 SemVer，如从 v1.0.5 升级到 v1.0.6)
git tag --sort=-v:refname | head -n 5
git tag -a v1.0.X -m "Release v1.0.X: <发布说明>"

# 5. 双远程同步推送 (推送至 gitea 触发 CI/CD 自动部署，同步推送 github 备份)
git push gitea main && git push gitea v1.0.X
git push origin main && git push origin v1.0.X
```

---

## 📋 详细工作流规范

### 1. 前置构建与检查
- **必须先构建前端**：项目采用 Go 单二进制内嵌机制（`embed.go`）。如果未执行 `npm run build`，Go 编译时只会包含旧版的前端静态文件。
- **运行单元测试**：确保所有接口与后端服务逻辑（如数据库操作、时间解析等）通过测试。

### 2. 版本号命名规范
| 类型 | 规则 | 示例 | 场景 |
| :--- | :--- | :--- | :--- |
| **补丁版本 (Patch)** | `vX.Y.(Z+1)` | `v1.0.5` -> `v1.0.6` | Bug 修复、样式调整、小细节改进 |
| **次版本 (Minor)** | `vX.(Y+1).0` | `v1.0.6` -> `v1.1.0` | 新增核心功能页面、向下兼容的业务特性 |
| **主版本 (Major)** | `v(X+1).0.0` | `v1.1.0` -> `v2.0.0` | 破坏性重构、存储或架构重大变革 |

### 3. 双远程仓库配置
- **主发布源 (`gitea`)**：`https://git.nextx.uk/nextx/jira-work.git`
  - 自动触发 `.gitea/workflows/release.yaml` 工作流。
  - 工作流会自动交叉编译为多平台二进制（Linux amd64/arm64、macOS amd64/arm64、Windows amd64），并发布到生产分发服务器。
- **备份源 (`origin`)**：`git@github.com:kingwsi/jira-cli.git`
  - GitHub 仓库同步归档。

### 4. 发布结果验证
发布流水线通常在 2-3 分钟内完成，可通过以下方式验证：
```bash
# 验证线上分发版本清单
curl -s https://nextx.uk/jira-work/latest/version.json | jq .
```

---

## 🛠️ 常见问题排查

1. **推送失败：Tag 冲突**：
   - 执行 `git fetch --tags` 获取最新 Tag，检查版本号是否已被占用。
2. **需要撤销误发布的 Tag**：
   ```bash
   git tag -d v1.0.X
   git push gitea --delete v1.0.X
   git push origin --delete v1.0.X
   ```
