package reminder

import (
	"strings"
	"testing"
	"time"

	"github.com/ws/jira-cli/internal/jira"
)

type fakeJiraClient struct {
	searches  []*jira.SearchResponse
	user      *jira.User
	worklogs  map[string][]jira.Worklog
	searchJQL []string
}

func (f *fakeJiraClient) Search(jql string, _ int) (*jira.SearchResponse, error) {
	f.searchJQL = append(f.searchJQL, jql)
	if len(f.searches) == 0 {
		return &jira.SearchResponse{}, nil
	}
	result := f.searches[0]
	f.searches = f.searches[1:]
	return result, nil
}

func (f *fakeJiraClient) GetCurrentUser() (*jira.User, error) { return f.user, nil }
func (f *fakeJiraClient) GetWorklogs(key string) ([]jira.Worklog, error) {
	return f.worklogs[key], nil
}

func TestIsScheduledNowLastChinaWorkday(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Schedule.Time = "17:30"

	// 2026-10-10 is a Saturday make-up workday and the last workday of that week.
	before := time.Date(2026, 10, 10, 17, 29, 0, 0, time.Local)
	due := time.Date(2026, 10, 10, 17, 30, 0, 0, time.Local)
	if IsScheduledNow(cfg.Schedule, before) {
		t.Fatal("schedule should not fire before configured time")
	}
	if !IsScheduledNow(cfg.Schedule, due) {
		t.Fatal("schedule should fire on the last workday, including make-up Saturday")
	}
}

func TestIsScheduledNowWeekendRule(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Schedule.Type = ScheduleWeekday
	cfg.Schedule.Weekday = int(time.Sunday)
	cfg.Schedule.Time = "09:00"
	if !IsScheduledNow(cfg.Schedule, time.Date(2026, 8, 30, 9, 0, 0, 0, time.Local)) {
		t.Fatal("Sunday schedule should fire")
	}
}

func TestCheckMissingWorklogUsesCurrentUserAndChinaWorkdays(t *testing.T) {
	now := time.Date(2026, 8, 28, 17, 30, 0, 0, time.Local) // Friday
	fake := &fakeJiraClient{
		searches: []*jira.SearchResponse{{Issues: []jira.Issue{{Key: "DSYFB-1"}}}},
		user:     &jira.User{Name: "me"},
		worklogs: map[string][]jira.Worklog{
			"DSYFB-1": {
				{Author: jira.User{Name: "me"}, Started: "2026-08-24T09:00:00.000+0800", TimeSpentSeconds: 8 * 3600},
				{Author: jira.User{Name: "other"}, Started: "2026-08-25T09:00:00.000+0800", TimeSpentSeconds: 8 * 3600},
			},
		},
	}
	report, err := Check(fake, now)
	if err != nil {
		t.Fatal(err)
	}
	if report.ExpectedWorkHours != 40 || report.ActualWorkHours != 8 {
		t.Fatalf("unexpected worklog totals: %#v", report)
	}
	if got := strings.Join(report.MissingWorkdays, ","); got != "2026-08-25,2026-08-26,2026-08-27,2026-08-28" {
		t.Fatalf("unexpected missing days: %s", got)
	}
}

func TestCheckQueriesOnlyCurrentUsersOpenIssues(t *testing.T) {
	fake := &fakeJiraClient{searches: []*jira.SearchResponse{{}, {Issues: []jira.Issue{
		{Key: "DUE-1", Fields: jira.RawIssueFields{Summary: "standard due date", DueDate: "2026-08-29"}},
		{Key: "DUE-2", Fields: jira.RawIssueFields{Summary: "custom end date", ExpectedEnd: "2026-08-28"}},
		{Key: "FUTURE-1", Fields: jira.RawIssueFields{Summary: "not due", DueDate: "2026-09-01"}},
		{Key: "NO-DATE", Fields: jira.RawIssueFields{Summary: "no due date"}},
	}}, {Issues: []jira.Issue{
		{Key: "ORDER-1", Fields: jira.RawIssueFields{Summary: "project task order", Project: jira.ProjectShort{Key: "YFJD"}, Updated: "2026-08-01"}},
		{Key: "ORDER-2", Fields: jira.RawIssueFields{Summary: "typed task order", IssueType: jira.IssueType{Name: "任务令"}, Updated: "2026-08-02"}},
		{Key: "ORDER-3", Fields: jira.RawIssueFields{Summary: "季度任务令跟踪", Updated: "2026-08-03"}},
		{Key: "OTHER-1", Fields: jira.RawIssueFields{Summary: "ordinary task", IssueType: jira.IssueType{Name: "任务"}, Updated: "2026-08-04"}},
	}}}, user: &jira.User{Name: "me"}}
	report, err := Check(fake, time.Date(2026, 8, 29, 10, 0, 0, 0, time.Local))
	if err != nil {
		t.Fatal(err)
	}
	if len(fake.searchJQL) != 3 {
		t.Fatalf("expected three searches, got %d", len(fake.searchJQL))
	}
	for _, jql := range fake.searchJQL[1:] {
		if !strings.Contains(jql, "assignee = currentUser()") || !strings.Contains(jql, "statusCategory != Done") {
			t.Fatalf("query is not personal/open-only: %s", jql)
		}
	}
	if strings.Contains(fake.searchJQL[1], "customfield_10301") {
		t.Fatalf("due query still depends on a fixed custom field: %s", fake.searchJQL[1])
	}
	if len(report.DueIssues) != 2 || report.DueIssues[0].Key != "DUE-2" || report.DueIssues[1].Key != "DUE-1" {
		t.Fatalf("unexpected due issues: %#v", report.DueIssues)
	}
	if len(report.StaleIssues) != 3 {
		t.Fatalf("stale reminder should include task orders only: %#v", report.StaleIssues)
	}
}

func TestPublicConfigDoesNotExposeChannelSecrets(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Channels = []Channel{{ID: "tg", Type: ChannelTelegram, BotToken: "secret", ChatID: "1"}, {ID: "hook", Type: ChannelWebhook, WebhookURL: "https://example.test/token"}}
	public := PublicConfig(cfg)
	for _, channel := range public.Channels {
		if channel.BotToken != "" || channel.WebhookURL != "" || !channel.SecretConfigured {
			t.Fatalf("secret sanitization failed: %#v", channel)
		}
	}
}
