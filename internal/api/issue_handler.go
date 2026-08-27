package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/models"
	"github.com/ws/jira-cli/internal/services"
)

type IssueHandler struct{}

func NewIssueHandler() *IssueHandler {
	return &IssueHandler{}
}

func resolveIssueType(client *jira.Client, inputType string) string {
	if inputType == "" {
		return ""
	}
	types, err := client.GetIssueTypes()
	if err != nil || len(types) == 0 {
		return inputType
	}

	// 1. Check exact match (case-insensitive)
	for _, t := range types {
		if strings.EqualFold(t.Name, inputType) {
			return t.Name
		}
	}

	// 2. Check alias for Bug / Defect / 缺陷 / 故障
	isBugQuery := strings.EqualFold(inputType, "bug") ||
		strings.EqualFold(inputType, "defect") ||
		inputType == "缺陷" ||
		inputType == "故障" ||
		strings.Contains(strings.ToLower(inputType), "bug") ||
		strings.Contains(inputType, "缺陷")
	if isBugQuery {
		for _, t := range types {
			lowerName := strings.ToLower(t.Name)
			if t.Name == "缺陷" || t.Name == "故障" || lowerName == "bug" || lowerName == "defect" || strings.Contains(t.Name, "缺陷") {
				return t.Name
			}
		}
	}

	// 3. Check alias for Task / 任务
	isTaskQuery := strings.EqualFold(inputType, "task") || inputType == "任务" || strings.Contains(inputType, "任务")
	if isTaskQuery {
		for _, t := range types {
			lowerName := strings.ToLower(t.Name)
			if (t.Name == "任务" || lowerName == "task") && !t.Subtask {
				return t.Name
			}
		}
	}

	// 4. Check alias for Subtask / 子任务
	isSubTaskQuery := strings.EqualFold(inputType, "subtask") || strings.EqualFold(inputType, "sub-task") || inputType == "子任务"
	if isSubTaskQuery {
		for _, t := range types {
			if t.Subtask || t.Name == "子任务" || strings.EqualFold(t.Name, "subtask") || strings.EqualFold(t.Name, "sub-task") {
				return t.Name
			}
		}
	}

	// 5. Check alias for Story / 故事 / 需求
	isStoryQuery := strings.EqualFold(inputType, "story") || inputType == "故事" || inputType == "需求" || inputType == "一般需求"
	if isStoryQuery {
		for _, t := range types {
			lowerName := strings.ToLower(t.Name)
			if t.Name == "故事" || t.Name == "一般需求" || t.Name == "需求" || lowerName == "story" {
				return t.Name
			}
		}
	}

	return inputType
}

func (h *IssueHandler) ListIssues(w http.ResponseWriter, r *http.Request) {
	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	query := r.URL.Query()
	jql := query.Get("jql")
	issueType := query.Get("type")
	status := query.Get("status")
	statusCategory := query.Get("statusCategory")
	assignee := query.Get("assignee")
	project := query.Get("project")
	limitStr := query.Get("limit")

	limit := 100
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	// 动态拼接 JQL
	if jql == "" {
		var conditions []string
		if project != "" {
			conditions = append(conditions, fmt.Sprintf("project = '%s'", project))
		}
		if issueType != "" {
			resolvedType := resolveIssueType(client, issueType)
			conditions = append(conditions, fmt.Sprintf("issuetype = '%s'", resolvedType))
		}
		if statusCategory != "" {
			switch strings.ToLower(statusCategory) {
			case "unresolved", "open", "todo_inprogress":
				conditions = append(conditions, "statusCategory in ('To Do', 'In Progress')")
			case "todo", "to do":
				conditions = append(conditions, "statusCategory = 'To Do'")
			case "in_progress", "inprogress", "in progress":
				conditions = append(conditions, "statusCategory = 'In Progress'")
			case "done", "resolved", "closed":
				conditions = append(conditions, "statusCategory = 'Done'")
			default:
				conditions = append(conditions, fmt.Sprintf("statusCategory = '%s'", statusCategory))
			}
		} else if status != "" {
			switch status {
			case "待办", "To Do", "todo", "新建", "新":
				conditions = append(conditions, "statusCategory = 'To Do'")
			case "进行中", "In Progress", "修复中", "处理中", "接受/处理":
				conditions = append(conditions, "statusCategory = 'In Progress'")
			case "已解决", "已完成", "已关闭", "Done", "Closed", "Resolved":
				conditions = append(conditions, "statusCategory = 'Done'")
			case "待处理", "未解决", "unresolved":
				conditions = append(conditions, "statusCategory in ('To Do', 'In Progress')")
			default:
				conditions = append(conditions, fmt.Sprintf("status = '%s'", status))
			}
		}
		if assignee == "" && (strings.EqualFold(issueType, "bug") || strings.EqualFold(issueType, "defect") || issueType == "缺陷" || issueType == "故障") {
			assignee = "currentUser()"
		}

		if assignee != "" && assignee != "all" && assignee != "*" {
			if assignee == "currentUser()" || assignee == "me" {
				conditions = append(conditions, "assignee = currentUser()")
			} else {
				conditions = append(conditions, fmt.Sprintf("assignee = '%s'", assignee))
			}
		}

		if len(conditions) > 0 {
			jql = strings.Join(conditions, " AND ") + " ORDER BY updated DESC"
		} else {
			jql = "ORDER BY updated DESC"
		}
	}

	resp, err := client.Search(jql, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询任务失败: "+err.Error())
		return
	}

	svc := services.NewPlanningService(client, "", "")
	var items []models.IssueItem
	for _, raw := range resp.Issues {
		items = append(items, svc.ConvertIssue(raw))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":  0,
		"total": resp.Total,
		"data":  items,
	})
}

func (h *IssueHandler) GetIssue(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "缺少 issue key")
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	issue, err := client.GetIssue(key)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取任务详情失败: "+err.Error())
		return
	}

	svc := services.NewPlanningService(client, "", "")
	item := svc.ConvertIssue(*issue)

	// 如果有子任务，查询子任务的完整字段（经办人、起止日期、预估工时）
	if len(item.Subtasks) > 0 {
		var subKeys []string
		for _, s := range item.Subtasks {
			subKeys = append(subKeys, fmt.Sprintf("'%s'", s.Key))
		}
		subJql := fmt.Sprintf("issue in (%s)", strings.Join(subKeys, ","))
		if resp, err := client.Search(subJql, len(subKeys)); err == nil && resp != nil {
			var fullSubtasks []models.IssueItem
			for _, subRaw := range resp.Issues {
				fullSubtasks = append(fullSubtasks, svc.ConvertIssue(subRaw))
			}
			item.Subtasks = fullSubtasks
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code": 0,
		"data": item,
	})
}

func (h *IssueHandler) CreateIssue(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Project     string `json:"project"`
		Summary     string `json:"summary"`
		IssueType   string `json:"issueType"`
		Description string `json:"description"`
		ParentKey   string `json:"parentKey,omitempty"`
		StartDate   string `json:"startDate,omitempty"`
		EndDate     string `json:"endDate,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "解析创建请求失败")
		return
	}

	if req.Project == "" || req.Summary == "" || req.IssueType == "" {
		writeError(w, http.StatusBadRequest, "项目、概要和类型不能为空")
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	resolvedType := resolveIssueType(client, req.IssueType)
	created, err := client.CreateIssue(req.Project, req.Summary, resolvedType, req.Description, req.ParentKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建任务失败: "+err.Error())
		return
	}

	// 如果指定了起止日期，做一次补充更新
	if req.StartDate != "" || req.EndDate != "" {
		updateFields := make(map[string]any)
		if req.StartDate != "" {
			updateFields["customfield_10300"] = req.StartDate
		}
		if req.EndDate != "" {
			updateFields["customfield_10301"] = req.EndDate
		}
		_ = client.UpdateIssue(created.Key, updateFields)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "创建成功",
		"data":    created,
	})
}

func (h *IssueHandler) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "缺少 issue key")
		return
	}

	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "解析更新数据失败")
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	fields := make(map[string]any)
	if summary, ok := req["summary"].(string); ok && summary != "" {
		fields["summary"] = summary
	}
	if desc, ok := req["description"].(string); ok {
		fields["description"] = desc
	}
	if start, ok := req["startDate"].(string); ok {
		fields["customfield_10300"] = start
	}
	if end, ok := req["endDate"].(string); ok {
		fields["customfield_10301"] = end
	}
	if assignee, ok := req["assignee"].(string); ok {
		fields["assignee"] = map[string]string{"name": assignee}
	}
	var rawEstimate string
	if est, ok := req["originalEstimate"].(string); ok {
		rawEstimate = est
	} else if est, ok := req["estimate"].(string); ok {
		rawEstimate = est
	}
	if rawEstimate = strings.TrimSpace(rawEstimate); rawEstimate != "" {
		if _, err := strconv.ParseFloat(rawEstimate, 64); err == nil {
			rawEstimate += "h"
		}
		fields["timetracking"] = map[string]string{
			"originalEstimate": rawEstimate,
		}
	}

	if len(fields) > 0 {
		if err := client.UpdateIssue(key, fields); err != nil {
			writeError(w, http.StatusInternalServerError, "更新任务失败: "+err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "更新成功",
	})
}

func (h *IssueHandler) GetTransitions(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "缺少 issue key")
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	transitions, err := client.GetTransitions(key)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取状态流转选项失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code": 0,
		"data": transitions,
	})
}

func (h *IssueHandler) DoTransition(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	var req struct {
		TransitionID string `json:"transitionId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TransitionID == "" {
		writeError(w, http.StatusBadRequest, "缺少 transitionId")
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	if err := client.DoTransition(key, req.TransitionID); err != nil {
		writeError(w, http.StatusInternalServerError, "流转状态失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "状态流转成功",
	})
}
