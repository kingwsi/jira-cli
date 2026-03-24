package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "jira",
	Short: "Jira CLI - 从命令行管理您的自托管 Jira 实例。",
	Long:  `一个使用 Go 编写的 Jira CLI 工具，用于与您的自托管 Jira 实例进行交互。`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.Version = "0.1.0"
}
