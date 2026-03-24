package cmd

import (
	"fmt"
	"os"

	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
)

var projectCmd = &cobra.Command{
	Use:   "project",
	Short: "管理 Jira 项目。",
}

var projectListCmd = &cobra.Command{
	Use:   "list",
	Short: "列出所有可访问的项目。",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := jira.NewClient()
		if err != nil {
			return err
		}

		fmt.Printf("正在获取项目列表...\n")
		
		projects, err := client.ListProjects()
		if err != nil {
			return err
		}

		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"键", "名称", "类型", "负责人"})
		table.SetBorder(false)
		table.SetHeaderLine(false)
		table.SetAlignment(tablewriter.ALIGN_LEFT)
		table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
		table.SetColumnSeparator("")

		for _, p := range projects {
			table.Append([]string{
				p.Key,
				p.Name,
				p.ProjectTypeKey,
				p.Lead.DisplayName,
			})
		}
		table.Render()

		return nil
	},
}

func init() {
	projectCmd.AddCommand(projectListCmd)
	rootCmd.AddCommand(projectCmd)
}
