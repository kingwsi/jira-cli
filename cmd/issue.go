package cmd

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/pterm/pterm"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
)

var issueCmd = &cobra.Command{
	Use:   "issue",
	Short: "管理 Jira 问题/任务。",
}

var issueGetCmd = &cobra.Command{
	Use:   "get [issue_key]",
	Short: "获取问题的详细信息。",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		client, err := jira.NewClient()
		if err != nil {
			return err
		}

		fmt.Printf("正在获取问题 %s 的详细信息...\n", key)
		
		issue, err := client.GetIssue(key)
		if err != nil {
			return err
		}

		color.Cyan("\n# %s", issue.Key)
		color.New(color.Bold).Println(issue.Fields.Summary)
		fmt.Println()

		fmt.Printf("状态:   %s\n", issue.Fields.Status.Name)
		fmt.Printf("类型:   %s\n", issue.Fields.IssueType.Name)
		fmt.Printf("优先级: %s\n", issue.Fields.Priority.Name)
		
		assignee := "未分配"
		if issue.Fields.Assignee != nil {
			assignee = issue.Fields.Assignee.DisplayName
		}
		fmt.Printf("经办人: %s\n", assignee)
		fmt.Printf("创建时间: %s\n", issue.Fields.Created[:10])

		if issue.Fields.Description != "" {
			color.New(color.Bold).Println("\n描述:")
			fmt.Println(issue.Fields.Description)
		}

		return nil
	},
}

var issueCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "创建新问题。",
	RunE: func(cmd *cobra.Command, args []string) error {
		project, _ := cmd.Flags().GetString("project")
		summary, _ := cmd.Flags().GetString("summary")
		issueType, _ := cmd.Flags().GetString("type")
		description, _ := cmd.Flags().GetString("description")

		if project == "" || summary == "" {
			return fmt.Errorf("项目键 (project) 和概要 (summary) 是必填项")
		}

		client, err := jira.NewClient()
		if err != nil {
			return err
		}

		fmt.Printf("正在项目 %s 中创建问题...\n", project)
		
		issue, err := client.CreateIssue(project, summary, issueType, description)
		if err != nil {
			return err
		}

		color.Green("✓ 问题已创建: %s", issue.Key)
		fmt.Printf("URL: %s/browse/%s\n", client.URL, issue.Key)

		return nil
	},
}

var issueUpdateCmd = &cobra.Command{
	Use:   "update [issue_key]",
	Short: "更新问题的属性。",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		start, _ := cmd.Flags().GetString("start")
		end, _ := cmd.Flags().GetString("end")
		estimate, _ := cmd.Flags().GetString("estimate")
		summary, _ := cmd.Flags().GetString("summary")
		version, _ := cmd.Flags().GetString("version")

		fields := make(map[string]interface{})
		if start != "" {
			fields["customfield_10300"] = start
		}
		if end != "" {
			fields["customfield_10301"] = end
		}
		if estimate != "" {
			fields["timetracking"] = map[string]interface{}{
				"originalEstimate": estimate,
			}
		}
		if summary != "" {
			fields["summary"] = summary
		}
		if version != "" {
			fields["customfield_10210"] = version
		}

		if len(fields) == 0 {
			return fmt.Errorf("没有指定任何要更新的字段")
		}

		spinner, _ := pterm.DefaultSpinner.Start(fmt.Sprintf("正在更新问题 %s...", key))
		
		client, err := jira.NewClient()
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		err = client.UpdateIssue(key, fields)
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		spinner.Success(fmt.Sprintf("问题 %s 更新成功", key))
		return nil
	},
}

func init() {
	issueCreateCmd.Flags().StringP("project", "p", "", "项目键 (必填)")
	issueCreateCmd.Flags().StringP("summary", "s", "", "问题概要 (必填)")
	issueCreateCmd.Flags().StringP("type", "t", "Task", "问题类型")
	issueCreateCmd.Flags().StringP("description", "d", "", "问题描述")

	issueUpdateCmd.Flags().String("start", "", "预计开始时间 (例如: 2023-10-27)")
	issueUpdateCmd.Flags().String("end", "", "预计结束时间 (例如: 2023-10-30)")
	issueUpdateCmd.Flags().String("estimate", "", "初始预估 (例如: 1d 2h 或 3600)")
	issueUpdateCmd.Flags().StringP("summary", "s", "", "更新概要/标题")
	issueUpdateCmd.Flags().String("version", "", "发布版本")

	issueCmd.AddCommand(issueGetCmd)
	issueCmd.AddCommand(issueCreateCmd)
	issueCmd.AddCommand(issueUpdateCmd)
	rootCmd.AddCommand(issueCmd)
}
