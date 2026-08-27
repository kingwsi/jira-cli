.PHONY: dev-api dev-web build run clean

# 1. 独立启动后端 API 服务 (监听 8080，供前端代理)
dev-api:
	go run main.go -p 8080 -o=false

# 2. 独立启动前端 Vite 开发服务器 (监听 5173，支持热更新，自动打开浏览器)
dev-web:
	cd web && npm run dev

# 3. 生产一键打包 (先编译前端输出到 internal/web/dist，再打包成单二进制程序)
build:
	cd web && npm run build
	go build -o jira main.go
	@echo "✓ 单二进制内嵌版本构建完成: ./jira"

# 4. 直接运行打包后的单二进制服务
run: build
	./jira

clean:
	rm -rf internal/web/dist
	rm -f jira
