# Jira Workbench

专为自托管 Jira 设计的现代化任务协同与排期工作台。采用 **Go + React/Vite** 架构，可独立前后端分离开发，也可一键打包为**单二进制可执行文件**（内嵌前端静态资源，零依赖开箱即用）。

---

## ✨ 核心特性

- 📊 **可视化甘特图排期**：支持按父子任务层级/版本/团队成员泳道多维度查看任务时间线，支持拖拽调整开始与截止时间。
- 👥 **团队成员泳道协同**：直观展示团队各成员排期密度、空闲天数与任务负荷，支持节假日高亮。
- ⏱️ **工时填报与统计**：支持周/月维度工时矩阵透视表与快捷填报工作日志。
- 🐞 **任务与缺陷快捷管理**：按状态多维度筛选、快速流转工作流、详情抽屉编辑与快速新建。
- 🔐 **安全凭据管理**：Jira 访问凭据优先保存在系统钥匙串（macOS Keychain / Windows Credential / Linux SecretService），支持无界面服务器降级配置。
- 📦 **单二进制零依赖分发**：前端静态资源通过 Go `embed` 内嵌，单个二进制即可在局域网内提供完整 Web 服务。

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
