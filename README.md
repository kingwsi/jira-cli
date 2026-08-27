# Jira CLI (Go Edition)

一个使用 Go 编写的 Jira 命令行工具，专为自托管 Jira 设计，支持编译为单二进制文件运行。

## 功能特性

- 🚀 **高性能**：Go 原生二进制文件，启动飞快。
- 📦 **零依赖**：无需安装 Python/Node.js 环境，编译后一个文件即可运行。
- 🔐 **安全存储**：凭据安全地存储在系统钥匙串（macOS Keychain/Windows Credentials），拒绝明文密码。
- 📊 **交互友好**：输出清晰的彩色表格和提示。
- 🔍 **便捷查询**：内置 `bugs` 和 `todos` 等常用查询命令。

## 本地开发与调试

```bash
# 终端 1：直接启动后端服务 (无弹窗，安静监听 8080)
go run main.go

# 终端 2：启动前端开发调试 (无弹窗，监听 5175，修改代码即时热重载)
cd web && npm run dev
```

---

## 生产一键打包 (嵌入式单二进制)

当你需要发布或单二进制分发时：

```bash
# 一键编译前端并内嵌打包为单二进制程序
./build.sh

# 运行生成的单二进制文件
./jira
```

### 2. 登录

Jira CLI 不再使用 `.env` 文件存储密码。请使用以下命令进行安全登录：

```bash
./jira login
# 按照提示输入 URL、用户名和密码/Token
```

凭据将加密存储在您的操作系统安全区域。

### 3. 注销

如果您想从系统中清除凭据：

```bash
./jira logout
```

## 使用方法

### 0. 启动 Web 工作台 (推荐)

启动内嵌的现代化 Web 工作台，支持可视化排期甘特图、团队成员泳道协同、父子任务联动与工时填报：

```bash
# 启动 Web 服务并在浏览器自动打开 (默认端口 8080)
./jira server

# 指定端口
./jira server -p 9000
```

### 1. 基本命令

```bash
# 查看帮助
./jira --help

# 查看当前登录状态
./jira config

# 测试连接
./jira ping
```

### 常用查询

```bash
# 查询我的缺陷列表 (DSYFB 项目)
./jira bugs

# 查询我的待办任务
./jira todos
```

### 问题 (Issue) 管理

```bash
# 获取问题详情
./jira issue get PROJ-123

# 创建新问题
./jira issue create -p PROJ -s "问题概要" -t "Task" -d "详细描述"

# 更新问题属性 (预计开始、结束、初始预估)
./jira issue update PROJ-123 --start "2023-11-01" --end "2023-11-05" --estimate "2d 4h"

# 仅更新概要
./jira issue update PROJ-123 -s "新的标题"
```

### 项目管理

```bash
# 列出所有项目
./jira project list
```

## License

MIT License
