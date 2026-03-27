package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
)

var debugCmd = &cobra.Command{
	Use:   "debug [issue_key]",
	Short: "调试：查看问题的原始 JSON 数据",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := jira.NewClient()
		if err != nil {
			return err
		}

		issue, err := client.GetIssue(args[0])
		if err != nil {
			return err
		}

		data, _ := json.MarshalIndent(issue, "", "  ")
		fmt.Println(string(data))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(debugCmd)
}
