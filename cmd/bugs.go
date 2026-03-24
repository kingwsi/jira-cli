package cmd

import (
	"github.com/pterm/pterm"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/ui"
)

var bugsCmd = &cobra.Command{
	Use:   "bugs",
	Short: "查询我的缺陷列表。",
	RunE: func(cmd *cobra.Command, args []string) error {
		spinner, _ := pterm.DefaultSpinner.Start("正在查询您的缺陷列表...")

		client, err := jira.NewClient()
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		jql := (
			"project = DSYFB AND issuetype = 缺陷 " +
				"AND status in (重新打开, 已验证, 已解决, \"接受/处理\", 新) " +
				"AND assignee in (currentUser())")

		result, err := client.Search(jql, 50)
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		spinner.Success(pterm.Sprintf("共找到 %d 个问题", result.Total))
		
		ui.RenderIssuesTable(result.Issues, client.URL)
		
		return nil
	},
}

func init() {
	rootCmd.AddCommand(bugsCmd)
}
