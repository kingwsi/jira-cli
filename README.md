# Jira Workbench

专为自托管 Jira 设计的现代化任务协同与排期工作台。采用 **Go + React/Vite** 架构，可独立前后端分离开发，也可一键打包为**单二进制可执行文件**（内嵌前端静态资源，零依赖开箱即用）。

---

## ✨ 核心特性

- 📊 **可视化甘特图排期**：支持按父子任务层级/版本/团队成员泳道多维度查看任务时间线，支持拖拽调整开始与截止时间。
- 👥 **团队成员泳道协同**：直观展示团队各成员排期密度、空闲天数与任务负荷，支持节假日高亮。
- ⏱️ **工时填报与统计**：支持周/月维度工时矩阵透视表与快捷填报工作日志。
- 🔔 **个人提醒与多通道推送**：可按每周最后一个工作日、周六或周日检查漏填工时、到期任务和长期未更新任务，并推送到 Telegram 或通用 Webhook。
- 🐞 **任务与缺陷快捷管理**：按状态多维度筛选、快速流转工作流、详情抽屉编辑与快速新建。
- 🔐 **安全凭据管理**：Jira 访问凭据优先保存在系统钥匙串（macOS Keychain / Windows Credential / Linux SecretService），支持无界面服务器降级配置。
- 📦 **单二进制零依赖分发**：前端静态资源通过 Go `embed` 内嵌，单个二进制即可在局域网内提供完整 Web 服务。
- 🤖 **AI Agent 运行指南**：完整的多环境运行、状态自检与运维规范详见 [RUNBOOK.md](file:///Users/ws/Documents/projects/jira-cli/RUNBOOK.md)。

---

## 🛠️ 本地开发与调试

```bash
# 1. 终端 1：启动后端 API 服务 (监听 8080)
make dev-api
# 或直接: go run main.go -p 8080

# 2. 终端 2：启动前端 Vite 开发服务 (监听 5175，支持热重载与 API 代理)
make dev-web
# 或直接: cd web && npm run dev
```

浏览器访问 `http://localhost:5175` 即可实时开发调试。

---

## 🚀 生产打包与运行

```bash
# 一键编译前端并打包生成单二进制程序
make build
# 或: ./build.sh

# 运行单二进制服务 (默认监听 0.0.0.0:8080，支持局域网访问)
./jira

# 运行并自动在默认浏览器中打开页面
./jira -open

# 指定端口与监听地址
./jira -p 9000 -H 127.0.0.1
```

### 命令行选项说明

| 选项 | 简写 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `--port` | `-p` | `8080` | Web 服务监听端口 |
| `--host` | `-H` | `0.0.0.0` | 监听地址（`0.0.0.0` 允许局域网设备访问） |
| `--open` | | `false` | 服务启动后自动在默认浏览器中打开页面 |
| `--version` | `-v` | `false` | 查看版本号 |
| `--help` | `-h` | | 查看帮助信息 |

---

## ⚙️ 首次使用配置

首次启动后，在 Web 界面左下角点击 **设置 (Settings)**，输入您的 Jira 服务器地址与账号密码：
- **Jira URL**：例如 `https://jira.yourcompany.com`
- **用户名 / 密码**：您的 Jira 账户凭据

系统将自动测试连通性并保存。

### 个人提醒配置

在 **设置 → 个人提醒与消息推送** 中可以：

- 选择“每周最后一个工作日”或指定星期，并设置提醒时间；最后一个工作日按中国大陆节假日与调休规则判断。
- 开启提醒后固定检查漏填工时、已到期/逾期任务和需求中超过 7 天未更新的任务令，无需逐项配置。
- 同时配置多个推送通道。Telegram 需要 Bot Token 和 Chat ID；通用 Webhook 接收 `{"text":"提醒内容"}` JSON。
- 使用“只检查不发送”预览事实和消息；保存后可发送测试消息，或立即检查并推送。

自动调度仅在 Jira Workbench 服务持续运行时生效，同一自然日最多自动执行一次。提醒配置中的 Token 和 Webhook URL 与 Jira 凭据分开保存，优先使用系统钥匙串；无钥匙串环境降级为权限为 `0600` 的 `~/.jira-workbench-notifications.json`。

中国工作日数据会在服务启动时读取本地缓存，并在后台从 [holiday-cn](https://github.com/NateScarlet/holiday-cn) 刷新当年和下一年的官方节假日/调休数据，此后每 24 小时检查一次。缓存保存在 `~/.jira-workbench-holidays/`；网络或数据源不可用时继续使用上一次缓存，缓存也不可用时再回退到内置日历和普通星期规则。

---

## 🐳 Docker Compose 部署

```bash
# 构建镜像并在后台启动
docker compose up -d --build

# 查看运行状态和日志
docker compose ps
docker compose logs -f jira-workbench

# 停止服务（保留 Jira 配置）
docker compose down
```

默认访问地址为 `http://localhost:9000`。如需修改宿主机端口：

```bash
JIRA_PORT=8080 docker compose up -d --build
```

Jira 连接配置保存在 Docker 命名卷 `jira-workbench-data` 中，重新创建容器不会丢失。若要连同配置一起删除，可执行 `docker compose down -v`。

---

## 📄 开源协议

[MIT License](LICENSE)

## 版本检查与更新

在 **设置 → 版本与更新** 查看当前版本、最新版本和检查结果。服务启动后及每 6 小时检查一次 `https://nextx.uk/jira-work/latest/version.json`；自动安装默认关闭，开启后在下一次周期检查发现新版本时安装，也可以点击“检查版本”和“立即更新并重启”。配置保存在 `~/.jira-workbench-updates.json`。

macOS / Linux 独立发布程序需显式启用，且运行账号必须对程序所在目录有写权限：

```bash
JIRA_SELF_UPDATE=1 ./jira
```

更新管理操作仅接受本机、同源请求；请通过服务所在机器的正式服务地址操作（开发前端跨域请求不支持更新）。自动检查无需开启安装权限。开发构建显示 `dev`，不会自动升级；正式流水线只允许 `v主版本.次版本.补丁版本` 稳定标签发布。

安装会从发布方的固定 HTTPS 地址下载对应平台的版本包，校验 SHA-256，检查包结构并执行新程序的版本自检，随后原子替换程序，等待现有 HTTP 请求结束并重启。旧程序保存在同目录的 `jira.previous`，如果新程序无法执行会尝试恢复旧程序。下载、校验或安装失败不会替换当前程序。SHA-256 用于完整性校验，信任边界仍是 HTTPS 发布服务器，并非独立的签名验证。

这是单实例的版本滚动升级，**不是多副本零停机滚动发布**：重启期间短暂不可用，请先保存表单。自动安装开启后也会重启。新版本启动后业务层面的故障不会自动回滚，需停止服务、用 `.previous` 恢复并重新启动。不会迁移或删除 Jira 配置。

Docker 不支持容器内自更新，仍使用 `docker compose up -d --build` 更新镜像及容器；Windows 使用下载页手动下载、停止旧程序后替换。两者仍可查看版本检查结果。

发布流水线同时生成带 SHA-256 的版本元数据和 `releases/vX.Y.Z/` 目录。不要移动或重打已经发布的版本标签，也不要删除旧版本目录；发布包应先上传，再切换最新版本元数据。旧流水线没有校验值的包会被拒绝安装，需先发布一个采用新流水线的稳定版本。

### Gitea 容器 Runner 发布目录

Gitea 流水线使用 `node:20-bookworm` job 容器，并显式挂载 `/var/www/jira-work:/var/www/jira-work`。宿主机需提前创建该目录、授予写权限，在 Runner 配置中仅允许该目录挂载，并确保 Nginx 实际服务此宿主机目录。只把目录挂载给 Runner 管理容器不够，job 容器也必须声明挂载。

流水线会在构建前验证挂载点和写权限；发布时通过 `deploy/publish-local.sh` 暂存产物，校验 SHA-256，保留历史版本，最后原子更新 `latest/version.json`。没有正确挂载、目录不可写或校验失败都会终止任务，不会继续报告发布成功。不需要 SSH Secrets，也不需要重启 Nginx。`cp -a dist/. /var/www/jira-work/` 可以写入共享目录，但流水线使用分阶段发布，以免更新客户端读到尚未上传完成的版本包。

GitHub 的托管 Runner 不使用这台服务器的目录映射，因此 `.github/workflows/release.yaml` 保持 SSH 发布方式。若启用该流水线，需配置 `SSH_HOST`、`SSH_USER`、`SSH_KEY`、`SSH_KNOWN_HOSTS`（预先核验的服务器公钥）和可选 `SSH_PORT`（默认 22）；远端需具备 Python 3，并允许该账号写入发布目录。两条流水线共用 `deploy/publish.py` 的发布校验及锁，避免同时覆盖发布文件。不要同时为同一版本标签发布内容不同的构建包。
