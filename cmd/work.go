package cmd

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattn/go-runewidth"
	"github.com/pterm/pterm"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/ui"
)

var workCmd = &cobra.Command{
	Use:   "work [issue_key] [time_spent]",
	Short: "管理工作日志 (默认进入交互模式)",
	RunE: func(cmd *cobra.Command, args []string) error {
		// If arguments are provided (e.g., cll work DSYFB-123 2h), treat it as 'add'
		if len(args) >= 2 {
			// Redirecting to workAddCmd
			return workAddCmd.RunE(workAddCmd, args)
		}
		
		// If there is exactly one argument and it is a known subcommand, it should have been caught.
		// If there is one argument and it is NOT a subcommand (e.g., just key), it will reach here.
		// Cobra handles subcommands first, so if we reach here with arg[0] == "list", it means 
		// Cobra didn't match it (which shouldn't happen if we register it).
		
		// If no arguments or just 1 argument, enter interactive mode
		return runInteractiveWork()
	},
}

var workAddCmd = &cobra.Command{
	Use:   "add [issue_key] [time_spent]",
	Short: "记录问题花费的工时 (例如: 1d 2h 30m)。",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		timeSpent := args[1]
		comment, _ := cmd.Flags().GetString("comment")
		dateStr, _ := cmd.Flags().GetString("date")

		startedStr := ""
		if dateStr != "" {
			parsed, err := time.Parse("2006-01-02", dateStr)
			if err != nil {
				return fmt.Errorf("日期格式错误，请使用 YYYY-MM-DD 格式，例如 2026-03-27")
			}
			now := time.Now()
			started := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())
			startedStr = started.Format("2006-01-02T15:04:05.000-0700")
		}

		spinner, _ := pterm.DefaultSpinner.Start(fmt.Sprintf("正在记录问题 %s 的工时...", key))

		client, err := jira.NewClient()
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		err = client.AddWorklog(key, timeSpent, comment, startedStr)
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		spinner.Success(fmt.Sprintf("成功记录工时: %s (问题: %s)", timeSpent, key))
		return nil
	},
}

var workListCmd = &cobra.Command{
	Use:   "list",
	Short: "概览最近一周的花费工时记录。",
	RunE: func(cmd *cobra.Command, args []string) error {
		spinner, _ := pterm.DefaultSpinner.Start("正在查询您最近的花费记录...")

		client, err := jira.NewClient()
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		me, err := client.GetCurrentUser()
		if err != nil {
			spinner.Fail("获取当前用户信息失败: " + err.Error())
			return err
		}

		today := time.Now()
		var days []time.Time
		for i := 6; i >= 0; i-- {
			days = append(days, today.AddDate(0, 0, -i))
		}

		startDateStr := days[0].Format("2006-01-02")
		jql := fmt.Sprintf("worklogAuthor = currentUser() AND worklogDate >= '%s'", startDateStr)

		result, err := client.Search(jql, 50)
		if err != nil {
			spinner.Fail(err.Error())
			return err
		}

		spinner.Success(fmt.Sprintf("过去7天在这 %d 个问题上记录了工时。", result.Total))

		type worklogMatrix map[string]map[string]int
		matrix := make(worklogMatrix)

		for _, issue := range result.Issues {
			logs, err := client.GetWorklogs(issue.Key)
			if err != nil {
				continue
			}

			if matrix[issue.Key] == nil {
				matrix[issue.Key] = make(map[string]int)
			}

			for _, log := range logs {
				isMe := false
				if log.Author.AccountID != "" && me.AccountID != "" && log.Author.AccountID == me.AccountID {
					isMe = true
				} else if log.Author.EmailAddress != "" && me.EmailAddress != "" && log.Author.EmailAddress == me.EmailAddress {
					isMe = true
				} else if log.Author.DisplayName == me.DisplayName {
					isMe = true
				} else if strings.EqualFold(log.Author.EmailAddress, client.Username) {
					isMe = true
				} else if me.AccountID == "" && me.EmailAddress == "" {
					isMe = true
				}

				if !isMe {
					continue
				}

				if len(log.Started) >= 10 {
					dateStr := log.Started[:10]
					matrix[issue.Key][dateStr] += log.TimeSpentSeconds
				}
			}
		}

		ui.RenderWorklogOverview(result.Issues, matrix, days, client.URL)
		return nil
	},
}

func runInteractiveWork() error {
	spinner, _ := pterm.DefaultSpinner.Start("正在获取您的任务列表...")
	client, err := jira.NewClient()
	if err != nil {
		spinner.Fail(err.Error())
		return err
	}

	// Get active tasks (similar to todos)
	jql := ("project = DSYFB AND issuetype in (subTaskIssueTypes(), 任务) " +
		"AND status in (规划中, 测试中, 验收中, 实现中) " +
		"AND assignee in (currentUser()) ORDER BY cf[10300] ASC")

	result, err := client.Search(jql, 50)
	if err != nil {
		spinner.Fail(err.Error())
		return err
	}
	spinner.Success("获取任务列表成功")

	if len(result.Issues) == 0 {
		pterm.Warning.Println("没有找到您的待办任务。")
		return nil
	}

	// 1. Select Issue
	options := make([]string, 0, len(result.Issues))
	for _, issue := range result.Issues {
		keyStr := runewidth.FillRight(issue.Key, 11)
		key := pterm.Cyan(keyStr)

		summary := issue.Fields.Summary
		if runewidth.StringWidth(summary) > 30 {
			summary = runewidth.Truncate(summary, 27, "...")
		}
		summary = runewidth.FillRight(summary, 30)

		estimate := ui.FormatDuration(issue.Fields.TimeOriginalEstimate)
		logged := ui.FormatDuration(issue.Fields.TimeSpent)

		expected := "-"
		if issue.Fields.ExpectedStart != "" || issue.Fields.ExpectedEnd != "" {
			start := issue.Fields.ExpectedStart
			if len(start) > 5 {
				start = start[5:] // 03-02
			}
			end := issue.Fields.ExpectedEnd
			if len(end) > 5 {
				end = end[5:] // 03-31
			}
			expected = fmt.Sprintf("%s~%s", start, end)
		}
		expected = runewidth.FillRight(expected, 11)

		// Layout: [KEY]  SUMMARY  | 预估: X  | 已记: Y  | 周期: Z
		options = append(options, fmt.Sprintf("%s | %s | 预估:%-5s | 已记:%-5s | 周期:%s", 
			key, summary, pterm.Magenta(estimate), pterm.Yellow(logged), pterm.Green(expected)))
	}

	selectedIssueStr, _ := pterm.DefaultInteractiveSelect.WithDefaultText("请选择要记录工时的 Issue").WithOptions(options).Show()
	
	// Find the issue object
	var selectedIssue jira.Issue
	for i, opt := range options {
		if opt == selectedIssueStr {
			selectedIssue = result.Issues[i]
			break
		}
	}

	// 2. Select Date (Last 7 days)
	dateOptions := make([]string, 0, 7)
	today := time.Now()
	for i := 0; i < 7; i++ {
		d := today.AddDate(0, 0, -i)
		weekday := []string{"日", "一", "二", "三", "四", "五", "六"}[d.Weekday()]
		dateOptions = append(dateOptions, fmt.Sprintf("%s (星期%s)%s", d.Format("2006-01-02"), weekday, map[bool]string{true: " [今天]", false: ""}[i == 0]))
	}

	selectedDateOption, _ := pterm.DefaultInteractiveSelect.WithDefaultText("请选择日期").WithOptions(dateOptions).Show()
	selectedDateStr := selectedDateOption[:10]

	// 3. Input Time
	hours, _ := pterm.DefaultInteractiveTextInput.WithDefaultText("请输入花费工时 (例如: 1.5h 或 2h30m)").Show()
	if hours == "" {
		return fmt.Errorf("工时不能为空")
	}

	// 4. Comment (Optional)
	comment, _ := pterm.DefaultInteractiveTextInput.WithDefaultText("备注 (可选)").Show()

	// Perform logging
	parsedDate, _ := time.Parse("2006-01-02", selectedDateStr)
	now := time.Now()
	started := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())
	startedStr := started.Format("2006-01-02T15:04:05.000-0700")

	finalSpinner, _ := pterm.DefaultSpinner.Start(fmt.Sprintf("正在为 %s 记录 %s ...", selectedIssue.Key, hours))
	err = client.AddWorklog(selectedIssue.Key, hours, comment, startedStr)
	if err != nil {
		finalSpinner.Fail(err.Error())
		return err
	}
	finalSpinner.Success(fmt.Sprintf("记录成功!"))

	return nil
}

func init() {
	workAddCmd.Flags().StringP("comment", "c", "", "工作日志备注")
	workAddCmd.Flags().StringP("date", "d", "", "记录日期 (例如: 2026-03-24)")

	workCmd.Flags().StringP("comment", "c", "", "工作日志备注")
	workCmd.Flags().StringP("date", "d", "", "记录日期 (例如: 2026-03-24)")

	workCmd.AddCommand(workListCmd)
	workCmd.AddCommand(workAddCmd)

	rootCmd.AddCommand(workCmd)
}
