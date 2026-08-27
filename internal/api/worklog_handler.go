package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/models"
	"github.com/ws/jira-cli/internal/services"
)

type WorklogHandler struct{}

func NewWorklogHandler() *WorklogHandler {
	return &WorklogHandler{}
}

func isMatchingWorklogAuthor(log jira.Worklog, currentUser *jira.User, targetAuthor string) bool {
	if targetAuthor == "" || targetAuthor == "all" || targetAuthor == "*" {
		return true
	}
	if targetAuthor == "currentUser()" || targetAuthor == "me" {
		if currentUser == nil {
			return true
		}
		if log.Author.AccountID != "" && currentUser.AccountID != "" && log.Author.AccountID == currentUser.AccountID {
			return true
		}
		if log.Author.EmailAddress != "" && currentUser.EmailAddress != "" && strings.EqualFold(log.Author.EmailAddress, currentUser.EmailAddress) {
			return true
		}
		if log.Author.Name != "" && currentUser.Name != "" && strings.EqualFold(log.Author.Name, currentUser.Name) {
			return true
		}
		if log.Author.DisplayName != "" && currentUser.DisplayName != "" && log.Author.DisplayName == currentUser.DisplayName {
			return true
		}
		return false
	}

	// Specific author string
	if log.Author.Name != "" && strings.EqualFold(log.Author.Name, targetAuthor) {
		return true
	}
	if log.Author.DisplayName != "" && strings.EqualFold(log.Author.DisplayName, targetAuthor) {
		return true
	}
	if log.Author.EmailAddress != "" && strings.EqualFold(log.Author.EmailAddress, targetAuthor) {
		return true
	}
	return false
}

func (h *WorklogHandler) GetWorklogMatrix(w http.ResponseWriter, r *http.Request) {
	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	month := r.URL.Query().Get("month")
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	author := r.URL.Query().Get("author")
	if author == "" {
		author = r.URL.Query().Get("assignee")
	}
	if author == "" {
		author = "currentUser()"
	}

	var jql string
	if author == "all" || author == "*" {
		jql = fmt.Sprintf("worklogDate >= '%s-01' ORDER BY updated DESC", month)
	} else if author == "currentUser()" || author == "me" {
		jql = fmt.Sprintf("worklogAuthor = currentUser() AND worklogDate >= '%s-01' ORDER BY updated DESC", month)
	} else {
		jql = fmt.Sprintf("worklogAuthor = '%s' AND worklogDate >= '%s-01' ORDER BY updated DESC", author, month)
	}

	resp, err := client.Search(jql, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询工时任务失败: "+err.Error())
		return
	}

	var currentUser *jira.User
	if author == "currentUser()" || author == "me" {
		currentUser, _ = client.GetCurrentUser()
	}

	svc := services.NewPlanningService(client, "", "")
	var issues []models.IssueItem
	var allWorklogs []jira.Worklog

	for _, raw := range resp.Issues {
		issueItem := svc.ConvertIssue(raw)
		issues = append(issues, issueItem)

		// 获取每个 issue 的 worklog
		logs, err := client.GetWorklogs(raw.Key)
		if err == nil {
			for _, log := range logs {
				if isMatchingWorklogAuthor(log, currentUser, author) {
					log.IssueKey = raw.Key
					allWorklogs = append(allWorklogs, log)
				}
			}
		}
	}

	matrix := svc.BuildWorklogMatrix(month, allWorklogs, issues)

	writeJSON(w, http.StatusOK, map[string]any{
		"code": 0,
		"data": matrix,
	})
}

func (h *WorklogHandler) AddWorklog(w http.ResponseWriter, r *http.Request) {
	var req models.AddWorklogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "解析工时数据失败")
		return
	}

	if req.IssueKey == "" || req.TimeSpent == "" {
		writeError(w, http.StatusBadRequest, "任务 Key 和 工时(timeSpent) 不能为空")
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	if err := client.AddWorklog(req.IssueKey, req.TimeSpent, req.Comment, req.Started); err != nil {
		writeError(w, http.StatusInternalServerError, "登记工时失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "工时登记成功",
	})
}
