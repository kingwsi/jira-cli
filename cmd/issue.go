package cmd

import (
	"fmt"

	"github.com/fatih/color"
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

func init() {
	issueCreateCmd.Flags().StringP("project", "p", "", "项目键 (必填)")
	issueCreateCmd.Flags().StringP("summary", "s", "", "问题概要 (必填)")
	issueCreateCmd.Flags().StringP("type", "t", "Task", "问题类型")
	issueCreateCmd.Flags().StringP("description", "d", "", "问题描述")

	issueCmd.AddCommand(issueGetCmd)
	issueCmd.AddCommand(issueCreateCmd)
	rootCmd.AddCommand(issueCmd)
}
