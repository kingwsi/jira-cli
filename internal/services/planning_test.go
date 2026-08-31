package services

import (
	"testing"
	"time"

	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/models"
)

func TestBuildPlanningTreeFiltersRejectedChildren(t *testing.T) {
	service := &PlanningService{}
	issues := []models.IssueItem{
		{Key: "PARENT-1", Summary: "父任务", Status: "进行中"},
		{Key: "CHILD-1", ParentKey: "PARENT-1", Status: "待办"},
		{Key: "CHILD-2", ParentKey: "PARENT-1", Status: "已拒绝"},
	}

	tree := service.BuildPlanningTree(issues)
	if len(tree) != 1 {
		t.Fatalf("expected one parent, got %d", len(tree))
	}
	if len(tree[0].Children) != 1 {
		t.Fatalf("expected one visible child, got %d", len(tree[0].Children))
	}
	if tree[0].Children[0].Key != "CHILD-1" {
		t.Fatalf("expected CHILD-1, got %s", tree[0].Children[0].Key)
	}
}

func TestBuildPlanningTreeDoesNotCreateVirtualParentForRejectedChild(t *testing.T) {
	service := &PlanningService{}
	issues := []models.IssueItem{
		{Key: "CHILD-1", ParentKey: "PARENT-1", Status: " 已拒绝 "},
	}

	tree := service.BuildPlanningTree(issues)
	if len(tree) != 0 {
		t.Fatalf("expected rejected child to be omitted, got %d tree nodes", len(tree))
	}
}

func TestBuildWorklogWeekView(t *testing.T) {
	service := &PlanningService{}
	issues := []models.IssueItem{
		{Key: "TASK-1", Summary: "任务一"},
	}

	// 2026-08-24 为周一, 2026-08-30 为周日
	worklogs := []jira.Worklog{
		{IssueKey: "TASK-1", Started: "2026-08-24T09:00:00.000+0800", TimeSpentSeconds: 8 * 3600},
		{IssueKey: "TASK-1", Started: "2026-08-26T09:00:00.000+0800", TimeSpentSeconds: 4 * 3600},
		// 前一周与下一周的记录应被过滤
		{IssueKey: "TASK-1", Started: "2026-08-23T09:00:00.000+0800", TimeSpentSeconds: 99 * 3600},
		{IssueKey: "TASK-1", Started: "2026-08-31T09:00:00.000+0800", TimeSpentSeconds: 99 * 3600},
	}

	view := service.BuildWorklogWeekView("2026-08-24", worklogs, issues)

	if view.WeekStart != "2026-08-24" || view.WeekEnd != "2026-08-30" {
		t.Fatalf("unexpected week range %s ~ %s", view.WeekStart, view.WeekEnd)
	}
	if len(view.Days) != 7 {
		t.Fatalf("expected 7 days, got %d", len(view.Days))
	}
	if view.Days[0].Weekday != int(time.Monday) {
		t.Fatalf("expected week to start on Monday, got weekday %d", view.Days[0].Weekday)
	}
	if view.TotalSpent != 12*3600 {
		t.Fatalf("expected total 12h, got %d seconds", view.TotalSpent)
	}
	if len(view.Rows) != 1 || view.Rows[0].IssueKey != "TASK-1" {
		t.Fatalf("unexpected rows %+v", view.Rows)
	}
	if got := view.DailyTotals["2026-08-26"]; got != 4*3600 {
		t.Fatalf("expected daily total 4h on 08-26, got %d", got)
	}
}

func TestConvertIssueAttachments(t *testing.T) {
	service := NewPlanningService(nil, "", "")
	raw := jira.Issue{
		Key: "BUG-101",
		ID:  "10001",
		Fields: jira.RawIssueFields{
			Summary:     "测试缺陷",
			Description: "请看截图：!image-2026-08-26.png!",
			IssueType:   jira.IssueType{Name: "Bug"},
			Status:      jira.Status{Name: "待办"},
			Attachment: []jira.Attachment{
				{
					ID:       "2001",
					Filename: "image-2026-08-26.png",
					Size:     10240,
					MimeType: "image/png",
				},
			},
		},
	}

	item := service.ConvertIssue(raw)
	if len(item.Attachments) != 1 {
		t.Fatalf("expected 1 attachment, got %d", len(item.Attachments))
	}
	att := item.Attachments[0]
	if att.ID != "2001" || att.Filename != "image-2026-08-26.png" {
		t.Fatalf("unexpected attachment: %+v", att)
	}
	if att.URL != "/api/v1/attachments/2001/image-2026-08-26.png" {
		t.Fatalf("unexpected URL: %s", att.URL)
	}
}
