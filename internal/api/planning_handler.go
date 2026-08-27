package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/models"
	"github.com/ws/jira-cli/internal/services"
)

type PlanningHandler struct{}

func NewPlanningHandler() *PlanningHandler {
	return &PlanningHandler{}
}

func (h *PlanningHandler) GetPlanningTree(w http.ResponseWriter, r *http.Request) {
	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	query := r.URL.Query()
	month := query.Get("month") // YYYY-MM
	project := query.Get("project")
	assignee := query.Get("assignee")
	includeSiblings := query.Get("includeSiblings") // "true" or "false"

	var conditions []string
	if project != "" {
		conditions = append(conditions, fmt.Sprintf("project = '%s'", project))
	}
	if assignee != "" {
		if assignee == "currentUser()" || assignee == "me" {
			conditions = append(conditions, "assignee = currentUser()")
		} else {
			conditions = append(conditions, fmt.Sprintf("assignee = '%s'", assignee))
		}
	}

	// 按照团队规范：标题必须包含对应月份编码（例如 "202608"）
	if month != "" {
		monthCode := strings.ReplaceAll(month, "-", "")
		conditions = append(conditions, fmt.Sprintf("summary ~ '%s'", monthCode))
	}

	// 动态检测 Jira 实例中真实存在的 Task / Subtask 类型名称，避免硬编码未知英文类型导致 JQL 400
	if allTypes, err := client.GetIssueTypes(); err == nil && len(allTypes) > 0 {
		var matchedTypes []string
		for _, t := range allTypes {
			lower := strings.ToLower(t.Name)
			if lower == "task" || lower == "sub-task" || lower == "subtask" || lower == "任务" || lower == "子任务" || t.Subtask {
				matchedTypes = append(matchedTypes, fmt.Sprintf("'%s'", t.Name))
			}
		}
		if len(matchedTypes) > 0 {
			conditions = append(conditions, fmt.Sprintf("issuetype in (%s)", strings.Join(matchedTypes, ", ")))
		}
	}

	jql := strings.Join(conditions, " AND ")
	if jql == "" {
		jql = "statusCategory != Done ORDER BY updated DESC"
	} else {
		jql += " ORDER BY updated DESC"
	}

	resp, err := client.Search(jql, 200)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询排期数据失败: "+err.Error())
		return
	}

	svc := services.NewPlanningService(client, "", "")
	var items []models.IssueItem
	for _, raw := range resp.Issues {
		items = append(items, svc.ConvertIssue(raw))
	}

	// 如果开启了显示所有子任务，则向上拉取父任务名下的全部兄弟子任务
	if includeSiblings != "false" {
		items = svc.EnrichWithParentAndSiblingTasks(items)
	}

	tree := svc.BuildPlanningTree(items)

	writeJSON(w, http.StatusOK, map[string]any{
		"code":  0,
		"total": len(tree),
		"data":  tree,
	})
}

func (h *PlanningHandler) GetTeamSwimlanes(w http.ResponseWriter, r *http.Request) {
	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	query := r.URL.Query()
	month := query.Get("month")
	project := query.Get("project")
	assignee := query.Get("assignee")

	var conditions []string
	if project != "" {
		conditions = append(conditions, fmt.Sprintf("project = '%s'", project))
	}
	if assignee != "" {
		if assignee == "currentUser()" || assignee == "me" {
			conditions = append(conditions, "assignee = currentUser()")
		} else {
			conditions = append(conditions, fmt.Sprintf("assignee = '%s'", assignee))
		}
	}
	// 按照团队规范：标题必须包含对应月份编码（例如 "202608"）
	if month != "" {
		monthCode := strings.ReplaceAll(month, "-", "")
		conditions = append(conditions, fmt.Sprintf("summary ~ '%s'", monthCode))
	}

	jql := strings.Join(conditions, " AND ")
	if jql == "" {
		jql = "statusCategory != Done ORDER BY updated DESC"
	} else {
		jql += " ORDER BY updated DESC"
	}

	resp, err := client.Search(jql, 250)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询团队排期数据失败: "+err.Error())
		return
	}

	svc := services.NewPlanningService(client, "", "")
	var items []models.IssueItem
	for _, raw := range resp.Issues {
		items = append(items, svc.ConvertIssue(raw))
	}

	// 自动向上关联父任务并拉取名下的全部兄弟子任务（获取同需求下其他成员的协同排期）
	items = svc.EnrichWithParentAndSiblingTasks(items)

	swimlanes := svc.BuildTeamSwimlanes(items)

	writeJSON(w, http.StatusOK, map[string]any{
		"code":  0,
		"total": len(swimlanes),
		"data":  swimlanes,
	})
}

func (h *PlanningHandler) BatchUpdateSchedule(w http.ResponseWriter, r *http.Request) {
	var req models.BatchScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "解析排期数据失败")
		return
	}

	if len(req.Updates) == 0 {
		writeError(w, http.StatusBadRequest, "没有需要更新的排期项")
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var errors []string
	successCount := 0

	for _, item := range req.Updates {
		if item.Key == "" {
			continue
		}
		fields := make(map[string]any)
		if item.StartDate != "" {
			fields["customfield_10300"] = item.StartDate
		}
		if item.EndDate != "" {
			fields["customfield_10301"] = item.EndDate
		}

		if len(fields) > 0 {
			if err := client.UpdateIssue(item.Key, fields); err != nil {
				errors = append(errors, fmt.Sprintf("%s: %v", item.Key, err))
			} else {
				successCount++
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":         0,
		"message":      fmt.Sprintf("批量更新完成: 成功 %d 条, 失败 %d 条", successCount, len(errors)),
		"successCount": successCount,
		"errors":       errors,
	})
}

func (h *PlanningHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	projects, err := client.ListProjects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取项目列表失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code": 0,
		"data": projects,
	})
}

func (h *PlanningHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	user, err := client.GetCurrentUser()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取用户信息失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code": 0,
		"data": user,
	})
}

func (h *PlanningHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	query := r.URL.Query().Get("query")
	users, err := client.SearchUsers(query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "搜索用户失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":  0,
		"total": len(users),
		"data":  users,
	})
}
