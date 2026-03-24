package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "显示当前登录的配置状态。",
	Run: func(cmd *cobra.Command, args []string) {
		client, err := jira.NewClient()
		if err != nil {
			color.Red("✗ %v", err)
			return
		}

		color.New(color.Bold).Println("当前配置信息 (来源: 系统钥匙串):\n")

		color.Green("✓ Jira 地址: %s", client.URL)
		color.Green("✓ 用户名:    %s", client.Username)

		password := client.Password
		preview := "***"
		if len(password) > 2 {
			preview = password[:2] + "***"
		}
		color.Green("✓ 认证信息:  %s", preview)
		
		fmt.Println("\n[说明] 凭据已加密存储在系统安全区域。")
	},
}

func init() {
	rootCmd.AddCommand(configCmd)
}
