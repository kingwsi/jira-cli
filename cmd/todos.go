package cmd

import (
	"github.com/pterm/pterm"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/ui"
)

var todosCmd = &cobra.Command{
	Use:   "todos",
	Short: "查询我的待办任务列表。",
	RunE: func(cmd *cobra.Command, args []string) error {
		spinner, _ := pterm.DefaultSpinner.Start("正在查询您的待办任务...")

		client, err := jira.NewClient()
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		jql := (
			"project = DSYFB AND issuetype in (subTaskIssueTypes(), 任务) " +
				"AND status in (规划中, 测试中, 验收中, 实现中) " +
				"AND assignee in (currentUser()) ORDER BY cf[10300] ASC")

		result, err := client.Search(jql, 50)
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		spinner.Success(pterm.Sprintf("共找到 %d 个问题", result.Total))
		
		ui.RenderTodosTable(result.Issues, client.URL)
		
		return nil
	},
}

func init() {
	rootCmd.AddCommand(todosCmd)
}
