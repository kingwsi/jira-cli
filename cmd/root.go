package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "jira",
	Short: "Jira Workbench - 任务与团队排期工作台",
	Long:  `用于与自托管 Jira 进行交互的工作台及管理服务。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return serverCmd.RunE(cmd, args)
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.Version = "0.1.0"
}
