package ui

import (
	"fmt"
	"time"

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
		{"Key", "Summary", "Status", "预计开始", "预计结束", "初始预估", "发布版本"},
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

		releaseVersion := "-"
		if len(issue.Fields.FixVersions) > 0 {
			releaseVersion = issue.Fields.FixVersions[0].Name
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
			pterm.Cyan(releaseVersion),
		})
	}

	pterm.DefaultTable.WithHasHeader().WithData(data).WithBoxed().Render()
}

func RenderWorklogOverview(issues []jira.Issue, matrix map[string]map[string]int, days []time.Time, baseURL string) {
	header := []string{"问题", "密钥", "已记录"}
	for _, d := range days {
		dayStr := d.Format("02")
		weekday := ""
		switch d.Weekday() {
		case time.Monday:
			weekday = "一"
		case time.Tuesday:
			weekday = "二"
		case time.Wednesday:
			weekday = "三"
		case time.Thursday:
			weekday = "四"
		case time.Friday:
			weekday = "五"
		case time.Saturday:
			weekday = "六"
		case time.Sunday:
			weekday = "日"
		}
		header = append(header, fmt.Sprintf("%s\n%s", dayStr, weekday))
	}

	data := pterm.TableData{header}

	totalSecondsByDay := make([]int, len(days))
	totalSecondsOverall := 0

	for _, issue := range issues {
		issueTotal := 0
		dayRow := make([]string, len(days))
		for i, d := range days {
			dateStr := d.Format("2006-01-02")
			secs := matrix[issue.Key][dateStr]
			issueTotal += secs
			totalSecondsByDay[i] += secs

			if secs == 0 {
				dayRow[i] = " "
			} else {
				dayRow[i] = pterm.Green(FormatDuration(secs))
			}
		}

		totalSecondsOverall += issueTotal

		if issueTotal > 0 {
			keyURL := fmt.Sprintf("%s/browse/%s", baseURL, issue.Key)
			keyLink := link(keyURL, pterm.Cyan(issue.Key))

			summary := issue.Fields.Summary
			if len(summary) > 20 {
				summary = summary[:17] + "..."
			}
			issueLink := link(keyURL, summary)

			row := []string{issueLink, keyLink, pterm.Yellow(FormatDuration(issueTotal))}
			row = append(row, dayRow...)
			data = append(data, row)
		}
	}

	// append total row
	totalRow := []string{"总计", " ", pterm.Magenta(FormatDuration(totalSecondsOverall))}
	for _, dayTotal := range totalSecondsByDay {
		if dayTotal == 0 {
			totalRow = append(totalRow, "0")
		} else {
			totalRow = append(totalRow, pterm.Magenta(FormatDuration(dayTotal)))
		}
	}
	data = append(data, totalRow)

	pterm.DefaultTable.WithHasHeader().WithData(data).WithBoxed().Render()
}
