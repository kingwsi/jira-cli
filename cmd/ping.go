package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
)

var pingCmd = &cobra.Command{
	Use:   "ping",
	Short: "测试与 Jira 服务器的连接。",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := jira.NewClient()
		if err != nil {
			return err
		}

		fmt.Printf("正在连接到 Jira 服务器 %s...\n", client.URL)
		
		info, err := client.Ping()
		if err != nil {
			color.Red("✗ 连接失败: %v", err)
			return nil
		}

		color.Green("✓ 连接成功!")
		fmt.Printf("\n服务器: %v\n", info["baseUrl"])
		fmt.Printf("版本: %v\n", info["version"])
		fmt.Printf("部署类型: %v\n", info["deploymentType"])

		user, err := client.GetCurrentUser()
		if err == nil {
			color.Cyan("\n当前登录用户: %s", user.DisplayName)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(pingCmd)
}
