package reminder

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/services"
)

const (
	defaultStaleIssueDays = 7
	defaultDailyHours     = 8
)

type jiraClient interface {
	Search(jql string, maxResults int) (*jira.SearchResponse, error)
	GetCurrentUser() (*jira.User, error)
	GetWorklogs(issueKey string) ([]jira.Worklog, error)
}

type Report struct {
	GeneratedAt       time.Time     `json:"generatedAt"`
	MissingWorkdays   []string      `json:"missingWorkdays"`
	DueIssues         []IssueNotice `json:"dueIssues"`
	StaleIssues       []IssueNotice `json:"staleIssues"`
	ExpectedWorkHours int           `json:"expectedWorkHours"`
	ActualWorkHours   float64       `json:"actualWorkHours"`
}

type IssueNotice struct {
	Key     string `json:"key"`
	Summary string `json:"summary"`
	Date    string `json:"date"`
}

func (r Report) Empty() bool {
	return len(r.MissingWorkdays) == 0 && len(r.DueIssues) == 0 && len(r.StaleIssues) == 0
}

func Check(client jiraClient, now time.Time) (Report, error) {
	report := Report{GeneratedAt: now}
	missing, expected, actual, err := checkMissingWorklogs(client, now)
	if err != nil {
		return report, err
	}
	report.MissingWorkdays = missing
	report.ExpectedWorkHours = expected
	report.ActualWorkHours = actual

	// Do not reference a fixed custom field in JQL: Jira installations use
	// different IDs, and an unknown field makes the whole reminder check fail.
	issues, err := client.Search("assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC", 100)
	if err != nil {
		return report, fmt.Errorf("查询到期任务失败: %w", err)
	}
	for _, issue := range issues.Issues {
		endDate := issueEndDate(issue)
		if endDate != "" && endDate <= now.Format("2006-01-02") {
			report.DueIssues = append(report.DueIssues, IssueNotice{Key: issue.Key, Summary: issue.Fields.Summary, Date: endDate})
		}
	}
	sort.Slice(report.DueIssues, func(i, j int) bool { return report.DueIssues[i].Date < report.DueIssues[j].Date })

	jql := fmt.Sprintf("assignee = currentUser() AND statusCategory != Done AND updated <= -%dd ORDER BY updated ASC", defaultStaleIssueDays)
	issues, err = client.Search(jql, 100)
	if err != nil {
		return report, fmt.Errorf("查询长期未更新任务失败: %w", err)
	}
	for _, issue := range issues.Issues {
		if isTaskOrder(issue) {
			report.StaleIssues = append(report.StaleIssues, IssueNotice{Key: issue.Key, Summary: issue.Fields.Summary, Date: datePart(issue.Fields.Updated)})
		}
	}
	return report, nil
}

func isTaskOrder(issue jira.Issue) bool {
	return issue.Fields.Project.Key == "YFJD" ||
		issue.Fields.IssueType.Name == "任务令" ||
		strings.Contains(issue.Fields.Summary, "任务令")
}

func issueEndDate(issue jira.Issue) string {
	if value := datePart(issue.Fields.ExpectedEnd); value != "" {
		return value
	}
	return datePart(issue.Fields.DueDate)
}

func checkMissingWorklogs(client jiraClient, now time.Time) ([]string, int, float64, error) {
	weekStart := startOfWeek(now)
	workdays := make([]string, 0, 5)
	for day := weekStart; !day.After(dayOnly(now)); day = day.AddDate(0, 0, 1) {
		if services.IsChinaWorkday(day) {
			workdays = append(workdays, day.Format("2006-01-02"))
		}
	}
	if len(workdays) == 0 {
		return nil, 0, 0, nil
	}
	start := workdays[0]
	end := workdays[len(workdays)-1]
	jql := fmt.Sprintf("worklogAuthor = currentUser() AND worklogDate >= '%s' AND worklogDate <= '%s' ORDER BY updated DESC", start, end)
	issues, err := client.Search(jql, 100)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("查询本周工时任务失败: %w", err)
	}
	currentUser, err := client.GetCurrentUser()
	if err != nil {
		return nil, 0, 0, fmt.Errorf("获取当前 Jira 用户失败: %w", err)
	}
	totals := make(map[string]int)
	for _, issue := range issues.Issues {
		logs, logErr := client.GetWorklogs(issue.Key)
		if logErr != nil {
			return nil, 0, 0, fmt.Errorf("读取 %s 工时失败: %w", issue.Key, logErr)
		}
		for _, log := range logs {
			if sameUser(log.Author, *currentUser) {
				date := datePart(log.Started)
				if date >= start && date <= end {
					totals[date] += log.TimeSpentSeconds
				}
			}
		}
	}
	missing := make([]string, 0)
	totalSeconds := 0
	for _, day := range workdays {
		seconds := totals[day]
		totalSeconds += seconds
		if seconds == 0 {
			missing = append(missing, day)
		}
	}
	return missing, len(workdays) * defaultDailyHours, float64(totalSeconds) / 3600, nil
}

func FormatReport(report Report) string {
	var b strings.Builder
	b.WriteString("Jira 个人提醒 · ")
	b.WriteString(report.GeneratedAt.Format("2006-01-02"))
	if report.Empty() {
		b.WriteString("\n\n本次检查未发现需要提醒的事项。")
		return b.String()
	}
	if len(report.MissingWorkdays) > 0 {
		b.WriteString(fmt.Sprintf("\n\n⏱ 工时：本周 %.1fh / 目标 %dh", report.ActualWorkHours, report.ExpectedWorkHours))
		b.WriteString("\n未填写日期：")
		b.WriteString(strings.Join(report.MissingWorkdays, "、"))
	}
	appendIssues := func(title string, issues []IssueNotice, dateLabel string) {
		if len(issues) == 0 {
			return
		}
		b.WriteString(fmt.Sprintf("\n\n%s（%d）", title, len(issues)))
		limit := len(issues)
		if limit > 10 {
			limit = 10
		}
		for _, issue := range issues[:limit] {
			b.WriteString(fmt.Sprintf("\n• %s %s", issue.Key, issue.Summary))
			if issue.Date != "" {
				b.WriteString(fmt.Sprintf("（%s %s）", dateLabel, issue.Date))
			}
		}
		if len(issues) > limit {
			b.WriteString(fmt.Sprintf("\n• 另有 %d 项，请在工作台查看", len(issues)-limit))
		}
	}
	appendIssues("📅 已到期或逾期任务", report.DueIssues, "截止")
	appendIssues(fmt.Sprintf("🕒 任务令超过 %d 天未更新", defaultStaleIssueDays), report.StaleIssues, "更新")
	return b.String()
}

func IsScheduledNow(schedule Schedule, now time.Time) bool {
	loc, err := time.LoadLocation(schedule.Timezone)
	if err == nil {
		now = now.In(loc)
	}
	if now.Format("15:04") < schedule.Time {
		return false
	}
	if schedule.Type == ScheduleWeekday {
		return int(now.Weekday()) == schedule.Weekday
	}
	if !services.IsChinaWorkday(now) {
		return false
	}
	for next := dayOnly(now).AddDate(0, 0, 1); !next.After(startOfWeek(now).AddDate(0, 0, 6)); next = next.AddDate(0, 0, 1) {
		if services.IsChinaWorkday(next) {
			return false
		}
	}
	return true
}

func startOfWeek(t time.Time) time.Time {
	offset := (int(t.Weekday()) + 6) % 7
	return dayOnly(t).AddDate(0, 0, -offset)
}

func dayOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func datePart(value string) string {
	if len(value) >= 10 {
		return value[:10]
	}
	return value
}

func sameUser(a, b jira.User) bool {
	values := [][2]string{{a.AccountID, b.AccountID}, {a.Name, b.Name}, {a.EmailAddress, b.EmailAddress}}
	for _, pair := range values {
		if pair[0] != "" && pair[1] != "" && strings.EqualFold(pair[0], pair[1]) {
			return true
		}
	}
	return a.DisplayName != "" && a.DisplayName == b.DisplayName
}
