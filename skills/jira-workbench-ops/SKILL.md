---
name: jira-workbench-ops
description: >-
  Comprehensive operations and runtime runbook for Jira Workbench. Use whenever an AI Agent or developer needs
  to check environment readiness, run the project in development mode (Vite + Go API), build or run the standalone
  single binary executable, run via Docker Compose, perform cross-platform process management (Windows, Linux, macOS),
  or troubleshoot runtime and persistence issues.
---

# Jira Workbench Operations & Runtime Skill

This skill provides step-by-step instructions, cross-platform commands, health check protocols, and troubleshooting workflows for running and managing **Jira Workbench**.

---

## 1. Quick Decision: Choose the Right Running Mode

| Mode | Best For | Ports | Requirements |
| :--- | :--- | :--- | :--- |
| **Development** | Feature coding, frontend UI iteration, hot reloading | Web: `5175`<br>API: `8080` | Node.js 20+, Go 1.22+ |
| **Standalone Binary** | Fast local testing, zero container overhead, single-file distribution | Web & API: `8080` (or `-p <port>`) | None (compiled executable) |
| **Docker Compose** | Multi-tenant/server deployment, containerized isolation | Web & API: `9000` (or `JIRA_PORT`) | Docker & Compose |

---

## 2. Environment Readiness Sniffing

Before executing commands, execute environment sniffing based on the current OS:

### macOS / Linux (Bash / Zsh)
```bash
# Check runtimes
node -v || echo "Node.js not installed"
npm -v || echo "npm not installed"
go version || echo "Go not installed"
docker --version && docker compose version || echo "Docker not ready"

# Check port availability
lsof -i :5175 || echo "Port 5175 free"
lsof -i :8080 || echo "Port 8080 free"
lsof -i :9000 || echo "Port 9000 free"
```

### Windows (PowerShell)
```powershell
# Check runtimes
node -v; npm -v; go version; docker --version; docker compose version

# Check port availability
Get-NetTCPConnection -LocalPort 5175 -ErrorAction SilentlyContinue || Write-Host "Port 5175 free"
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue || Write-Host "Port 8080 free"
Get-NetTCPConnection -LocalPort 9000 -ErrorAction SilentlyContinue || Write-Host "Port 9000 free"
```

---

## 3. Execution Workflows

### Mode 1: Development (Vite HMR + Go API)

Vite proxies `/api/*` to the Go backend listening on `:8080`.

#### macOS / Linux
```bash
# 1. Install frontend dependencies (if not installed)
cd web && npm install && cd ..

# 2. Start Go Backend (Session 1)
go run main.go -p 8080 -H 0.0.0.0
# Or: make dev-api

# 3. Start Vite Dev Server (Session 2)
cd web && npm run dev
# Or: make dev-web
```

#### Windows (PowerShell)
```powershell
# 1. Install frontend dependencies
cd web; npm install; cd ..

# 2. Start Go Backend (Window 1)
go run main.go -p 8080 -H 0.0.0.0

# 3. Start Vite Frontend (Window 2)
cd web; npm run dev
```

#### Verify
```bash
curl -s http://127.0.0.1:8080/api/auth/status
curl -s -I http://127.0.0.1:5175
```

---

### Mode 2: Compiled Standalone Binary (`go:embed`)

Compiles the frontend into `internal/web/dist` and embeds all assets into a single standalone binary.

#### 1. Build
- **macOS / Linux**:
  ```bash
  make build
  # Or: ./build.sh
  ```
- **Windows (PowerShell)**:
  ```powershell
  cd web; npm run build; cd ..
  go build -ldflags="-s -w" -o jira.exe main.go
  ```

#### 2. Cross-Platform Build (from any OS)
```bash
# Windows x64:
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o dist/jira-windows-amd64.exe main.go

# Linux x64:
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o dist/jira-linux-amd64 main.go

# macOS Apple Silicon (M1/M2/M3/M4):
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o dist/jira-darwin-arm64 main.go
```

#### 3. Run & Process Lifecycle

- **macOS / Linux**:
  ```bash
  # Background daemon
  nohup ./jira -p 8080 > server.log 2>&1 &
  echo $! > server.pid

  # Stop daemon
  kill $(cat server.pid) && rm -f server.pid
  ```

- **Windows (PowerShell)**:
  ```powershell
  # Background process
  $p = Start-Process -FilePath ".\jira.exe" -ArgumentList "-p 8080" -PassThru -NoNewWindow
  $p.Id > server.pid

  # Stop process
  Stop-Process -Id (Get-Content server.pid) -Force; Remove-Item server.pid
  ```

---

### Mode 3: Docker Compose

Runs a multi-stage Alpine-based container with non-root security.

```bash
# 1. Build and start in background
docker compose up -d --build

# 2. Custom host port (e.g. 8080)
# Linux / macOS:
JIRA_PORT=8080 docker compose up -d
# Windows PowerShell:
$env:JIRA_PORT="8080"; docker compose up -d

# 3. View status and logs
docker compose ps
docker compose logs -f --tail=100

# 4. Stop container (preserves data volume)
docker compose down

# 5. Destroy container and clean data volume
docker compose down -v
```

---

## 4. Multi-Environment Persistence Reference

| Platform | Keyring Store | Fallback File Path | Permissions |
| :--- | :--- | :--- | :--- |
| **macOS** | macOS Keychain | `~/.jira-workbench*.json` | User-scoped |
| **Linux (GUI)** | SecretService / Gnome-Keyring | `~/.jira-workbench*.json` | `0600` |
| **Linux (Headless / Server)** | Auto-fallback to file | `~/.jira-workbench*.json` | `0600` |
| **Windows** | Windows Credential Manager | `%USERPROFILE%\.jira-workbench*.json` | User-scoped |
| **Docker** | Auto-fallback inside container | `/data/.jira-workbench*.json` | Persistent Volume |

---

## 5. Agent Automation API

AI Agents can configure and verify the running server via HTTP:

- **Check Auth Status**:
  ```http
  GET /api/auth/status
  ```
- **Login & Save Jira Credentials**:
  ```http
  POST /api/auth/login
  Content-Type: application/json

  {
    "url": "https://jira.example.com",
    "username": "your-username",
    "password": "your-password-or-token"
  }
  ```
- **Test Webhook Channel**:
  ```http
  POST /api/reminders/test-webhook
  Content-Type: application/json

  {
    "url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
  }
  ```

---

## 6. Troubleshooting Playbook

1. **`pattern dist/*: no matching files found`**
   - *Fix*: Frontend must be built before `go build`. Run `cd web && npm run build && cd ..` then compile.
2. **Port Conflict (`bind: address already in use`)**
   - *Fix*: Pass `-p <other-port>` (e.g. `./jira -p 8888` or `JIRA_PORT=8888 docker compose up -d`).
3. **Headless Linux Keyring Warning**
   - *Behavior*: Expected and safe. The application automatically degrades to `~/.jira-workbench.json` with `0600` permission.
