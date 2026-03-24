package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/auth"
)

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "从系统钥匙串中删除存储的凭据。",
	RunE: func(cmd *cobra.Command, args []string) error {
		err := auth.DeleteConfig()
		if err != nil {
			return fmt.Errorf("删除凭据失败: %v", err)
		}

		color.Yellow("✓ 凭据已从系统钥匙串中删除。")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(logoutCmd)
}
