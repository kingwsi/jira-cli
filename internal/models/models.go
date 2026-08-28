package models

import (
	"time"
)

// IssueItem 代表前端统一展示的任务/缺陷模型
type IssueItem struct {
	Key               string      `json:"key"`
	ID                string      `json:"id"`
	ProjectKey        string      `json:"projectKey"`
	Summary           string      `json:"summary"`
	Description       string      `json:"description,omitempty"`
	IssueType         string      `json:"issueType"` // Task, Bug, Story, Epic, Sub-task
	Status            string      `json:"status"`
	StatusCategory    string      `json:"statusCategory,omitempty"` // To Do, In Progress, Done
	Priority          string      `json:"priority"`
	Assignee          *UserInfo   `json:"assignee,omitempty"`
	Reporter          *UserInfo   `json:"reporter,omitempty"`
	ParentKey         string      `json:"parentKey,omitempty"`
	ParentSummary     string      `json:"parentSummary,omitempty"`
	StartDate         string      `json:"startDate,omitempty"` // YYYY-MM-DD
	EndDate           string      `json:"endDate,omitempty"`   // YYYY-MM-DD
	OriginalEstimate  int64       `json:"originalEstimateSeconds"`
	RemainingEstimate int64       `json:"remainingEstimateSeconds"`
	TimeSpent         int64       `json:"timeSpentSeconds"`
	CreatedAt         time.Time   `json:"createdAt"`
	UpdatedAt         time.Time   `json:"updatedAt"`
	Subtasks          []IssueItem `json:"subtasks,omitempty"`
}

type UserInfo struct {
	AccountID    string `json:"accountId,omitempty"`
	Name         string `json:"name"`
	DisplayName  string `json:"displayName"`
	EmailAddress string `json:"emailAddress,omitempty"`
	AvatarURL    string `json:"avatarUrl,omitempty"`
}

// PlanningTreeNode 父子层级树节点
type PlanningTreeNode struct {
	Key              string             `json:"key"`
	Summary          string             `json:"summary"`
	IssueType        string             `json:"issueType"`
	Status           string             `json:"status"`
	Priority         string             `json:"priority"`
	Assignee         *UserInfo          `json:"assignee,omitempty"`
	StartDate        string             `json:"startDate"` // 自身排期或计算得出的聚合开始日期
	EndDate          string             `json:"endDate"`   // 自身排期或计算得出的聚合结束日期
	OriginalEstimate int64              `json:"originalEstimateSeconds"`
	TimeSpent        int64              `json:"timeSpentSeconds"`
	ProgressPercent  int                `json:"progressPercent"` // 0 - 100
	IsParent         bool               `json:"isParent"`
	Children         []PlanningTreeNode `json:"children,omitempty"`
}

// SwimlaneMember 团队人员泳道模型
type SwimlaneMember struct {
	User           UserInfo       `json:"user"`
	TotalTasks     int            `json:"totalTasks"`
	TotalEstimate  int64          `json:"totalEstimateSeconds"`
	Tasks          []TimelineTask `json:"tasks"`
	DailyWorkloads map[string]int `json:"dailyWorkloads"` // date (YYYY-MM-DD) -> estimated seconds
}

// TimelineTask 时间线上的具体任务条目
type TimelineTask struct {
	Key              string `json:"key"`
	Summary          string `json:"summary"`
	IssueType        string `json:"issueType"`
	Status           string `json:"status"`
	Priority         string `json:"priority"`
	ParentKey        string `json:"parentKey,omitempty"`
	ParentSummary    string `json:"parentSummary,omitempty"`
	StartDate        string `json:"startDate"`
	EndDate          string `json:"endDate"`
	OriginalEstimate int64  `json:"originalEstimateSeconds"`
	TimeSpent        int64  `json:"timeSpentSeconds"`
	ProgressPercent  int    `json:"progressPercent"`
	IsOverdue        bool   `json:"isOverdue"`
}

// BatchScheduleRequest 批量修改排期请求
type BatchScheduleRequest struct {
	Updates []ScheduleUpdateItem `json:"updates"`
}

type ScheduleUpdateItem struct {
	Key              string `json:"key"`
	StartDate        string `json:"startDate,omitempty"` // YYYY-MM-DD
	EndDate          string `json:"endDate,omitempty"`   // YYYY-MM-DD
	OriginalEstimate string `json:"estimate,omitempty"`  // e.g. "2d 4h"
}

// WorklogMatrixRow 某一任务在某个月份各天的工时填报明细
type WorklogMatrixRow struct {
	IssueKey     string           `json:"issueKey"`
	IssueSummary string           `json:"issueSummary"`
	IssueType    string           `json:"issueType"`
	AssigneeName string           `json:"assigneeName"`
	TotalSpent   int64            `json:"totalSpentSeconds"`
	DailySpent   map[string]int64 `json:"dailySpentSeconds"` // date (YYYY-MM-DD) -> seconds
}

type WorklogMatrixResponse struct {
	Month       string             `json:"month"` // YYYY-MM
	DaysInMonth int                `json:"daysInMonth"`
	TotalSpent  int64              `json:"totalSpentSeconds"`
	Rows        []WorklogMatrixRow `json:"rows"`
}

// WorklogWeekDay 周视图中的单日基础信息
type WorklogWeekDay struct {
	Date    string `json:"date"`    // YYYY-MM-DD
	Weekday int    `json:"weekday"` // 0=周日, 1=周一 ... 6=周六
	IsToday bool   `json:"isToday"`
	IsPast  bool   `json:"isPast"`
}

// WorklogWeekResponse 一周工时填报视图 (周一 ~ 周日)
type WorklogWeekResponse struct {
	WeekStart   string             `json:"weekStart"` // YYYY-MM-DD 周一
	WeekEnd     string             `json:"weekEnd"`   // YYYY-MM-DD 周日
	Days        []WorklogWeekDay   `json:"days"`
	TotalSpent  int64              `json:"totalSpentSeconds"`
	DailyTotals map[string]int64   `json:"dailyTotalsSeconds"` // date -> 当日合计秒数
	Rows        []WorklogMatrixRow `json:"rows"`
}

// AddWorklogRequest 添加工作日志
type AddWorklogRequest struct {
	IssueKey  string `json:"issueKey"`
	TimeSpent string `json:"timeSpent"` // "2h", "1d"
	Started   string `json:"started"`   // "2026-08-26" or RFC3339
	Comment   string `json:"comment"`
}

// ServerConfig 业务配置
type ServerConfig struct {
	URL                  string   `json:"url"`
	Username             string   `json:"username"`
	IsConfigured         bool     `json:"isConfigured"`
	CustomFieldStartDate string   `json:"customFieldStartDate"` // 如 customfield_10100
	CustomFieldEndDate   string   `json:"customFieldEndDate"`   // 如 customfield_10101
	CustomFieldEpicLink  string   `json:"customFieldEpicLink"`  // 如 customfield_10014
	DefaultProject       string   `json:"defaultProject"`
	TeamMembers          []string `json:"teamMembers"`
}
