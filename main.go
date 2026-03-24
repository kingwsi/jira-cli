package main

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/ws/jira-cli/cmd"
	"github.com/ws/jira-cli/internal/jira"
)

func main() {
	if err := cmd.Execute(); err != nil {
		// 检查是否为认证错误
		if _, ok := err.(*jira.AuthError); ok {
			color.Red("\n[身份验证失败]")
			fmt.Printf("错误: %v\n", err)
			color.Yellow("\n请运行以下命令重新登录:")
			fmt.Println("  jira login")
			os.Exit(1)
		}

		// 其他普通错误
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}
