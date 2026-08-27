package services

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/models"
)

type PlanningService struct {
	client               *jira.Client
	customFieldStartDate string
	customFieldEndDate   string
}

func NewPlanningService(client *jira.Client, startField, endField string) *PlanningService {
	if startField == "" {
		startField = "customfield_10300"
	}
	if endField == "" {
		endField = "customfield_10301"
	}
	return &PlanningService{
		client:               client,
		customFieldStartDate: startField,
		customFieldEndDate:   endField,
	}
}

// EnrichWithParentAndSiblingTasks 根据当前任务列表，向上查找父任务并自动拉取这些父任务名下的所有兄弟子任务
func (s *PlanningService) EnrichWithParentAndSiblingTasks(initialItems []models.IssueItem) []models.IssueItem {
	if len(initialItems) == 0 {
		return initialItems
	}

	itemMap := make(map[string]models.IssueItem)
	parentKeySet := make(map[string]struct{})

	for _, item := range initialItems {
		itemMap[item.Key] = item
		if item.ParentKey != "" {
			parentKeySet[item.ParentKey] = struct{}{}
		}
		if len(item.Subtasks) > 0 {
			parentKeySet[item.Key] = struct{}{}
		}
	}

	if len(parentKeySet) == 0 {
		return initialItems
	}

	var parentKeys []string
	for k := range parentKeySet {
		parentKeys = append(parentKeys, k)
	}

	// 构造分批 JQL，每次最多查询 30 个父任务名下的所有子任务及父任务本身
	batchSize := 30
	for i := 0; i < len(parentKeys); i += batchSize {
		end := i + batchSize
		if end > len(parentKeys) {
			end = len(parentKeys)
		}
		batch := parentKeys[i:end]
		quoted := make([]string, len(batch))
		for j, k := range batch {
			quoted[j] = fmt.Sprintf("'%s'", k)
		}
		keysJoined := strings.Join(quoted, ",")
		jql := fmt.Sprintf("parent in (%s) OR issue in (%s)", keysJoined, keysJoined)

		resp, err := s.client.Search(jql, 300)
		if err == nil && resp != nil {
			for _, raw := range resp.Issues {
				converted := s.ConvertIssue(raw)
				if _, exists := itemMap[converted.Key]; !exists {
					itemMap[converted.Key] = converted
				}
			}
		}
	}

	var result []models.IssueItem
	for _, it := range itemMap {
		result = append(result, it)
	}

	return result
}

// ConvertIssue 将 Jira 原始 Issue 转换为系统内部通用的 IssueItem
func (s *PlanningService) ConvertIssue(raw jira.Issue) models.IssueItem {
	item := models.IssueItem{
		Key:               raw.Key,
		ID:                raw.ID,
		ProjectKey:        raw.Fields.Project.Key,
		Summary:           raw.Fields.Summary,
		Description:       raw.Fields.Description,
		IssueType:         raw.Fields.IssueType.Name,
		Status:            raw.Fields.Status.Name,
		Priority:          raw.Fields.Priority.Name,
		OriginalEstimate:  raw.Fields.TimeOriginalEstimate,
		RemainingEstimate: raw.Fields.TimeEstimate,
		TimeSpent:         raw.Fields.TimeSpent,
	}

	if raw.Fields.Status.StatusCategory != nil {
		item.StatusCategory = raw.Fields.Status.StatusCategory.Name
	}

	if raw.Fields.Assignee != nil {
		name := raw.Fields.Assignee.DisplayName
		if name == "" {
			name = raw.Fields.Assignee.Name
		}
		item.Assignee = &models.UserInfo{
			AccountID:    raw.Fields.Assignee.AccountID,
			Name:         raw.Fields.Assignee.Name,
			DisplayName:  name,
			EmailAddress: raw.Fields.Assignee.EmailAddress,
		}
	}

	if raw.Fields.Reporter != nil {
		name := raw.Fields.Reporter.DisplayName
		if name == "" {
			name = raw.Fields.Reporter.Name
		}
		item.Reporter = &models.UserInfo{
			AccountID:    raw.Fields.Reporter.AccountID,
			Name:         raw.Fields.Reporter.Name,
			DisplayName:  name,
			EmailAddress: raw.Fields.Reporter.EmailAddress,
		}
	}

	if raw.Fields.Parent != nil {
		item.ParentKey = raw.Fields.Parent.Key
		item.ParentSummary = raw.Fields.Parent.Fields.Summary
	}

	// 提取起止时间
	item.StartDate = s.extractDateField(raw, s.customFieldStartDate, raw.Fields.ExpectedStart)
	item.EndDate = s.extractDateField(raw, s.customFieldEndDate, raw.Fields.ExpectedEnd)

	// 解析时间
	if t, err := time.Parse(time.RFC3339, raw.Fields.Created); err == nil {
		item.CreatedAt = t
	}
	if t, err := time.Parse(time.RFC3339, raw.Fields.Updated); err == nil {
		item.UpdatedAt = t
	}

	// 解析子任务
	if len(raw.Fields.Subtasks) > 0 {
		for _, sub := range raw.Fields.Subtasks {
			subItem := models.IssueItem{
				Key:           sub.Key,
				ID:            sub.ID,
				Summary:       sub.Fields.Summary,
				IssueType:     sub.Fields.IssueType.Name,
				Status:        sub.Fields.Status.Name,
				Priority:      sub.Fields.Priority.Name,
				ParentKey:     raw.Key,
				ParentSummary: raw.Fields.Summary,
			}
			item.Subtasks = append(item.Subtasks, subItem)
		}
	}

	return item
}

func (s *PlanningService) extractDateField(raw jira.Issue, customFieldKey, defaultVal string) string {
	if defaultVal != "" {
		return strings.Split(defaultVal, "T")[0]
	}
	if raw.Fields.ExtraFields != nil {
		if val, ok := raw.Fields.ExtraFields[customFieldKey]; ok && val != nil {
			if strVal, ok := val.(string); ok && strVal != "" {
				return strings.Split(strVal, "T")[0]
			}
		}
	}
	return ""
}

// BuildPlanningTree 构建父子任务层级树
func (s *PlanningService) BuildPlanningTree(issues []models.IssueItem) []models.PlanningTreeNode {
	issueMap := make(map[string]*models.IssueItem)
	for i := range issues {
		issueMap[issues[i].Key] = &issues[i]
	}

	// 找出所有父节点与子节点归属
	parentChildrenMap := make(map[string][]models.IssueItem)
	var rootIssues []models.IssueItem

	for _, item := range issues {
		if item.ParentKey != "" {
			if isRejectedStatus(item.Status) {
				continue
			}
			parentChildrenMap[item.ParentKey] = append(parentChildrenMap[item.ParentKey], item)
		} else {
			rootIssues = append(rootIssues, item)
		}
	}

	// 构建父任务树节点
	var nodes []models.PlanningTreeNode
	processedParentKeys := make(map[string]bool)

	for _, root := range rootIssues {
		node := s.convertToTreeNode(root)
		children := parentChildrenMap[root.Key]
		var childNodes []models.PlanningTreeNode

		for _, child := range children {
			childNodes = append(childNodes, s.convertToTreeNode(child))
		}

		// 同一个父任务名下的子任务按开始时间正序排序 (升序)
		sort.Slice(childNodes, func(i, j int) bool {
			// 如果都有开始时间，按开始时间正序
			if childNodes[i].StartDate != "" && childNodes[j].StartDate != "" {
				if childNodes[i].StartDate != childNodes[j].StartDate {
					return childNodes[i].StartDate < childNodes[j].StartDate
				}
				if childNodes[i].EndDate != childNodes[j].EndDate {
					return childNodes[i].EndDate < childNodes[j].EndDate
				}
				return childNodes[i].Key < childNodes[j].Key
			}
			// 有开始时间的排在前面，未排期的排在后面
			if childNodes[i].StartDate != "" && childNodes[j].StartDate == "" {
				return true
			}
			if childNodes[i].StartDate == "" && childNodes[j].StartDate != "" {
				return false
			}
			return childNodes[i].Key < childNodes[j].Key
		})

		node.Children = childNodes
		node.IsParent = len(childNodes) > 0

		// 聚合父任务的起止时间和进度
		s.rollupParentNode(&node)
		nodes = append(nodes, node)
		processedParentKeys[root.Key] = true
	}

	// 处理那些子任务在列表里、但父任务本身不在 rootIssues 中的情况（比如仅查了子任务）
	for parentKey, children := range parentChildrenMap {
		if !processedParentKeys[parentKey] {
			parentSummary := parentKey
			if len(children) > 0 && children[0].ParentSummary != "" {
				parentSummary = children[0].ParentSummary
			}
			virtualParent := models.PlanningTreeNode{
				Key:       parentKey,
				Summary:   parentSummary,
				IssueType: "Parent",
				Status:    "In Progress",
				IsParent:  true,
			}
			var childNodes []models.PlanningTreeNode
			for _, child := range children {
				childNodes = append(childNodes, s.convertToTreeNode(child))
			}
			// 子任务按开始时间正序排序
			sort.Slice(childNodes, func(i, j int) bool {
				if childNodes[i].StartDate != "" && childNodes[j].StartDate != "" {
					if childNodes[i].StartDate != childNodes[j].StartDate {
						return childNodes[i].StartDate < childNodes[j].StartDate
					}
					if childNodes[i].EndDate != childNodes[j].EndDate {
						return childNodes[i].EndDate < childNodes[j].EndDate
					}
					return childNodes[i].Key < childNodes[j].Key
				}
				if childNodes[i].StartDate != "" && childNodes[j].StartDate == "" {
					return true
				}
				if childNodes[i].StartDate == "" && childNodes[j].StartDate != "" {
					return false
				}
				return childNodes[i].Key < childNodes[j].Key
			})
			virtualParent.Children = childNodes
			s.rollupParentNode(&virtualParent)
			nodes = append(nodes, virtualParent)
			processedParentKeys[parentKey] = true
		}
	}

	// 父需求列表排序：先按开始日期正序，有日期的在前，再按 Key
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].StartDate != "" && nodes[j].StartDate != "" {
			if nodes[i].StartDate != nodes[j].StartDate {
				return nodes[i].StartDate < nodes[j].StartDate
			}
			return nodes[i].Key < nodes[j].Key
		}
		if nodes[i].StartDate != "" && nodes[j].StartDate == "" {
			return true
		}
		if nodes[i].StartDate == "" && nodes[j].StartDate != "" {
			return false
		}
		return nodes[i].Key < nodes[j].Key
	})

	return nodes
}

func isRejectedStatus(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "已拒绝")
}

func (s *PlanningService) convertToTreeNode(item models.IssueItem) models.PlanningTreeNode {
	progress := 0
	if item.OriginalEstimate > 0 && item.TimeSpent > 0 {
		progress = int(float64(item.TimeSpent) / float64(item.OriginalEstimate) * 100)
		if progress > 100 {
			progress = 100
		}
	} else if strings.EqualFold(item.Status, "已完成") || strings.EqualFold(item.Status, "Closed") || strings.EqualFold(item.Status, "Done") {
		progress = 100
	}

	return models.PlanningTreeNode{
		Key:              item.Key,
		Summary:          item.Summary,
		IssueType:        item.IssueType,
		Status:           item.Status,
		Priority:         item.Priority,
		Assignee:         item.Assignee,
		StartDate:        item.StartDate,
		EndDate:          item.EndDate,
		OriginalEstimate: item.OriginalEstimate,
		TimeSpent:        item.TimeSpent,
		ProgressPercent:  progress,
		IsParent:         false,
	}
}

func (s *PlanningService) rollupParentNode(node *models.PlanningTreeNode) {
	if len(node.Children) == 0 {
		return
	}

	minStart := node.StartDate
	maxEnd := node.EndDate
	var totalEstimate int64
	var totalSpent int64
	var completedChildren int

	for _, child := range node.Children {
		if child.StartDate != "" {
			if minStart == "" || child.StartDate < minStart {
				minStart = child.StartDate
			}
		}
		if child.EndDate != "" {
			if maxEnd == "" || child.EndDate > maxEnd {
				maxEnd = child.EndDate
			}
		}
		totalEstimate += child.OriginalEstimate
		totalSpent += child.TimeSpent
		if child.ProgressPercent == 100 {
			completedChildren++
		}
	}

	if node.StartDate == "" {
		node.StartDate = minStart
	}
	if node.EndDate == "" {
		node.EndDate = maxEnd
	}
	if node.OriginalEstimate == 0 {
		node.OriginalEstimate = totalEstimate
	}
	if node.TimeSpent == 0 {
		node.TimeSpent = totalSpent
	}

	if len(node.Children) > 0 {
		if totalEstimate > 0 {
			node.ProgressPercent = int(float64(totalSpent) / float64(totalEstimate) * 100)
			if node.ProgressPercent > 100 {
				node.ProgressPercent = 100
			}
		} else {
			node.ProgressPercent = int(float64(completedChildren) / float64(len(node.Children)) * 100)
		}
	}
}

// BuildTeamSwimlanes 构建团队人员泳道及工时负荷
func (s *PlanningService) BuildTeamSwimlanes(issues []models.IssueItem) []models.SwimlaneMember {
	memberMap := make(map[string]*models.SwimlaneMember)

	for _, item := range issues {
		assigneeKey := "Unassigned"
		assigneeInfo := models.UserInfo{
			Name:        "Unassigned",
			DisplayName: "未指派",
		}
		if item.Assignee != nil && item.Assignee.DisplayName != "" {
			assigneeKey = item.Assignee.DisplayName
			assigneeInfo = *item.Assignee
		}

		member, exists := memberMap[assigneeKey]
		if !exists {
			member = &models.SwimlaneMember{
				User:           assigneeInfo,
				DailyWorkloads: make(map[string]int),
			}
			memberMap[assigneeKey] = member
		}

		member.TotalTasks++
		member.TotalEstimate += item.OriginalEstimate

		// 进度计算
		progress := 0
		if item.OriginalEstimate > 0 && item.TimeSpent > 0 {
			progress = int(float64(item.TimeSpent) / float64(item.OriginalEstimate) * 100)
			if progress > 100 {
				progress = 100
			}
		} else if strings.EqualFold(item.Status, "已完成") || strings.EqualFold(item.Status, "Closed") || strings.EqualFold(item.Status, "Done") {
			progress = 100
		}

		// 是否逾期
		isOverdue := false
		if item.EndDate != "" && progress < 100 {
			if endT, err := time.Parse("2006-01-02", item.EndDate); err == nil {
				if time.Now().After(endT.Add(24 * time.Hour)) {
					isOverdue = true
				}
			}
		}

		task := models.TimelineTask{
			Key:              item.Key,
			Summary:          item.Summary,
			IssueType:        item.IssueType,
			Status:           item.Status,
			Priority:         item.Priority,
			ParentKey:        item.ParentKey,
			ParentSummary:    item.ParentSummary,
			StartDate:        item.StartDate,
			EndDate:          item.EndDate,
			OriginalEstimate: item.OriginalEstimate,
			TimeSpent:        item.TimeSpent,
			ProgressPercent:  progress,
			IsOverdue:        isOverdue,
		}
		member.Tasks = append(member.Tasks, task)

		// 均摊工时到每日负荷
		if item.StartDate != "" && item.EndDate != "" && item.OriginalEstimate > 0 {
			startT, err1 := time.Parse("2006-01-02", item.StartDate)
			endT, err2 := time.Parse("2006-01-02", item.EndDate)
			if err1 == nil && err2 == nil && !endT.Before(startT) {
				var workdays []string
				cur := startT
				for !cur.After(endT) {
					if IsChinaWorkday(cur) {
						workdays = append(workdays, cur.Format("2006-01-02"))
					}
					cur = cur.AddDate(0, 0, 1)
				}
				if len(workdays) > 0 {
					dailySeconds := int(item.OriginalEstimate) / len(workdays)
					for _, day := range workdays {
						member.DailyWorkloads[day] += dailySeconds
					}
				}
			}
		}
	}

	var result []models.SwimlaneMember
	for _, member := range memberMap {
		// 对该成员的任务按开始日期正序排序 (升序)
		sort.Slice(member.Tasks, func(i, j int) bool {
			if member.Tasks[i].StartDate != "" && member.Tasks[j].StartDate != "" {
				if member.Tasks[i].StartDate != member.Tasks[j].StartDate {
					return member.Tasks[i].StartDate < member.Tasks[j].StartDate
				}
				if member.Tasks[i].EndDate != member.Tasks[j].EndDate {
					return member.Tasks[i].EndDate < member.Tasks[j].EndDate
				}
				return member.Tasks[i].Key < member.Tasks[j].Key
			}
			if member.Tasks[i].StartDate != "" && member.Tasks[j].StartDate == "" {
				return true
			}
			if member.Tasks[i].StartDate == "" && member.Tasks[j].StartDate != "" {
				return false
			}
			return member.Tasks[i].Key < member.Tasks[j].Key
		})
		result = append(result, *member)
	}

	// 人员排序：未指派放最后，其余按姓名拼音/字母排序
	sort.Slice(result, func(i, j int) bool {
		if result[i].User.Name == "Unassigned" {
			return false
		}
		if result[j].User.Name == "Unassigned" {
			return true
		}
		return result[i].User.DisplayName < result[j].User.DisplayName
	})

	return result
}

// BuildWorklogMatrix 生成指定月份的工时填报矩阵
func (s *PlanningService) BuildWorklogMatrix(monthStr string, worklogs []jira.Worklog, issues []models.IssueItem) models.WorklogMatrixResponse {
	// monthStr 格式: "2026-08"
	if monthStr == "" {
		monthStr = time.Now().Format("2006-01")
	}

	monthTime, err := time.Parse("2006-01", monthStr)
	if err != nil {
		monthTime = time.Now()
		monthStr = monthTime.Format("2006-01")
	}

	firstDay := time.Date(monthTime.Year(), monthTime.Month(), 1, 0, 0, 0, 0, time.Local)
	lastDay := firstDay.AddDate(0, 1, -1)
	daysInMonth := lastDay.Day()

	issueMap := make(map[string]models.IssueItem)
	for _, it := range issues {
		issueMap[it.Key] = it
	}

	rowsMap := make(map[string]*models.WorklogMatrixRow)
	var totalMonthSpent int64

	for _, wl := range worklogs {
		// 解析 started
		startedDate := ""
		if len(wl.Started) >= 10 {
			startedDate = wl.Started[:10]
		}
		if !strings.HasPrefix(startedDate, monthStr) {
			continue
		}

		issueKey := wl.IssueKey
		if issueKey == "" {
			issueKey = "UNKNOWN"
		}
		row, exists := rowsMap[issueKey]
		if !exists {
			item := issueMap[issueKey]
			assignee := "Unknown"
			if item.Assignee != nil {
				assignee = item.Assignee.DisplayName
			}
			row = &models.WorklogMatrixRow{
				IssueKey:     issueKey,
				IssueSummary: item.Summary,
				IssueType:    item.IssueType,
				AssigneeName: assignee,
				DailySpent:   make(map[string]int64),
			}
			rowsMap[issueKey] = row
		}

		row.DailySpent[startedDate] += int64(wl.TimeSpentSeconds)
		row.TotalSpent += int64(wl.TimeSpentSeconds)
		totalMonthSpent += int64(wl.TimeSpentSeconds)
	}

	var rows []models.WorklogMatrixRow
	for _, r := range rowsMap {
		rows = append(rows, *r)
	}

	sort.Slice(rows, func(i, j int) bool {
		return rows[i].TotalSpent > rows[j].TotalSpent
	})

	return models.WorklogMatrixResponse{
		Month:       monthStr,
		DaysInMonth: daysInMonth,
		TotalSpent:  totalMonthSpent,
		Rows:        rows,
	}
}
