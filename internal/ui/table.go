package ui

import (
	"fmt"
	"github.com/pterm/pterm"
	"github.com/ws/jira-cli/internal/jira"
)

// link 构造一个符合 OSC 8 标准的终端超链接
func link(url string, text string) string {
	return fmt.Sprintf("\x1b]8;;%s\x1b\\%s\x1b]8;;\x1b\\", url, text)
}

func RenderIssuesTable(issues []jira.Issue, baseURL string) {
	data := pterm.TableData{
		{"Key", "Summary", "Status", "Assignee"},
	}

	for _, issue := range issues {
		assignee := "Unassigned"
		if issue.Fields.Assignee != nil {
			assignee = issue.Fields.Assignee.DisplayName
		}
		
		summary := issue.Fields.Summary
		if len(summary) > 50 {
			summary = summary[:47] + "..."
		}

		// 手动构造超链接
		issueURL := fmt.Sprintf("%s/browse/%s", baseURL, issue.Key)
		keyLink := link(issueURL, pterm.Cyan(issue.Key))

		data = append(data, []string{
			keyLink,
			summary,
			pterm.Green(issue.Fields.Status.Name),
			pterm.Yellow(assignee),
		})
	}

	pterm.DefaultTable.WithHasHeader().WithData(data).WithBoxed().Render()
}

func RenderTodosTable(issues []jira.Issue, baseURL string) {
	data := pterm.TableData{
		{"Key", "Summary", "Status", "预计开始", "预计结束", "初始预估"},
	}

	for _, issue := range issues {
		summary := issue.Fields.Summary
		if len(summary) > 50 {
			summary = summary[:47] + "..."
		}
		
		expectedStart := issue.Fields.ExpectedStart
		if expectedStart == "" {
			expectedStart = "-"
		}
		expectedEnd := issue.Fields.ExpectedEnd
		if expectedEnd == "" {
			expectedEnd = "-"
		}

		// 手动构造超链接
		issueURL := fmt.Sprintf("%s/browse/%s", baseURL, issue.Key)
		keyLink := link(issueURL, pterm.Cyan(issue.Key))

		data = append(data, []string{
			keyLink,
			summary,
			pterm.LightGreen(issue.Fields.Status.Name),
			pterm.Green(expectedStart),
			pterm.Yellow(expectedEnd),
			pterm.Magenta(FormatDuration(issue.Fields.TimeOriginalEstimate)),
		})
	}

	pterm.DefaultTable.WithHasHeader().WithData(data).WithBoxed().Render()
}
