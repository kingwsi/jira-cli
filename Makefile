.PHONY: dev-api dev-web build run clean test

# 1. 独立启动后端 API 服务 (监听 8080，供前端开发代理)
dev-api:
	go run main.go -p 8080

# 2. 独立启动前端 Vite 开发服务器 (监听 5175，支持热更新与 API 代理)
dev-web:
	cd web && npm run dev

# 3. 生产一键打包 (编译前端并内嵌输出至单二进制程序)
build:
	cd web && npm run build
	go build -ldflags="-s -w" -o jira main.go
	@echo "✓ 生产单二进制程序构建完成: ./jira"

# 4. 运行单二进制服务并自动打开浏览器
run: build
	./jira -open

# 5. 运行单元测试
test:
	go test -v ./...

# 6. 清理构建缓存
clean:
	rm -rf internal/web/dist
	rm -f jira jira-cli jcli
