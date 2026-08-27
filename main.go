package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/ws/jira-cli/internal/server"
)

var (
	Version = "1.0.0"
)

func main() {
	var (
		port        int
		host        string
		openBrowser bool
		showVersion bool
	)

	flag.IntVar(&port, "port", 8080, "HTTP 服务监听端口")
	flag.IntVar(&port, "p", 8080, "HTTP 服务监听端口 (简写)")
	flag.StringVar(&host, "host", "0.0.0.0", "HTTP 服务监听地址 (0.0.0.0 允许局域网访问)")
	flag.StringVar(&host, "H", "0.0.0.0", "HTTP 服务监听地址 (简写)")
	flag.BoolVar(&openBrowser, "open", false, "服务启动后自动在浏览器中打开工作台")
	flag.BoolVar(&showVersion, "version", false, "显示版本号")
	flag.BoolVar(&showVersion, "v", false, "显示版本号 (简写)")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Jira Workbench - 任务与团队排期工作台 Web 服务\n\n")
		fmt.Fprintf(os.Stderr, "使用方式:\n")
		fmt.Fprintf(os.Stderr, "  jira [选项]\n\n")
		fmt.Fprintf(os.Stderr, "选项列表:\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	if showVersion {
		fmt.Printf("Jira Workbench v%s\n", Version)
		return
	}

	cfg := server.Config{
		Host:        host,
		Port:        port,
		OpenBrowser: openBrowser,
		Version:     Version,
	}

	if err := server.Run(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "服务启动失败: %v\n", err)
		os.Exit(1)
	}
}
