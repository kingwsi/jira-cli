# Jira CLI (Go Edition)

一个使用 Go 编写的 Jira 命令行工具，专为自托管 Jira 设计，支持编译为单二进制文件运行。

## 功能特性

- 🚀 **高性能**：Go 原生二进制文件，启动飞快。
- 📦 **零依赖**：无需安装 Python/Node.js 环境，编译后一个文件即可运行。
- 🔐 **安全存储**：凭据安全地存储在系统钥匙串（macOS Keychain/Windows Credentials），拒绝明文密码。
- 📊 **交互友好**：输出清晰的彩色表格和提示。
- 🔍 **便捷查询**：内置 `bugs` 和 `todos` 等常用查询命令。

## 安装与配置

### 1. 从源码编译

```bash
git clone <repository-url>
cd jira-cli
go build -o jira main.go
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

### 基本命令

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
```

### 项目管理

```bash
# 列出所有项目
./jira project list
```

## License

MIT License
