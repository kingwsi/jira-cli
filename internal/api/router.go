package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/ws/jira-cli/internal/reminder"
	"github.com/ws/jira-cli/internal/updater"
	"github.com/ws/jira-cli/internal/web"
)

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{
		"code":    status,
		"message": message,
	})
}

// corsMiddleware 跨域支持，方便开发环境前后端独立运行
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// NewRouter 创建并注册所有 API 路由以及静态资源托管
func NewRouter(reminderService *reminder.Service, updates ...*updater.Service) http.Handler {
	mux := http.NewServeMux()
	// Two fixed metadata entries plus at most 128 user-search query entries.
	metadataCache := newMemoryCache(130)

	cfgH := NewConfigHandler(metadataCache)
	issueH := NewIssueHandler()
	planH := NewPlanningHandler(metadataCache)
	workH := NewWorklogHandler()
	reminderH := NewReminderHandler(reminderService)

	if len(updates) > 0 {
		registerUpdates(mux, updates[0])
	}

	// 1. 系统与配置
	mux.HandleFunc("GET /api/v1/config", cfgH.GetConfig)
	mux.HandleFunc("POST /api/v1/config", cfgH.SaveConfig)
	mux.HandleFunc("POST /api/v1/config/test", cfgH.TestConnection)
	mux.HandleFunc("GET /api/v1/jira/fields", cfgH.GetFields)

	// 2. 项目与用户
	mux.HandleFunc("GET /api/v1/projects", planH.ListProjects)
	mux.HandleFunc("GET /api/v1/users/me", planH.GetCurrentUser)
	mux.HandleFunc("GET /api/v1/users/search", planH.SearchUsers)

	// 3. 任务与缺陷
	mux.HandleFunc("GET /api/v1/issues", issueH.ListIssues)
	mux.HandleFunc("GET /api/v1/issues/{key}", issueH.GetIssue)
	mux.HandleFunc("POST /api/v1/issues", issueH.CreateIssue)
	mux.HandleFunc("PATCH /api/v1/issues/{key}", issueH.UpdateIssue)
	mux.HandleFunc("GET /api/v1/issues/{key}/transitions", issueH.GetTransitions)
	mux.HandleFunc("POST /api/v1/issues/{key}/transitions", issueH.DoTransition)
	mux.HandleFunc("GET /api/v1/issues/{key}/comments", issueH.GetComments)
	mux.HandleFunc("POST /api/v1/issues/{key}/comments", issueH.AddComment)
	mux.HandleFunc("POST /api/v1/issues/{key}/progress", issueH.UpdateWeeklyProgress)
	mux.HandleFunc("GET /api/v1/attachments/{id}/{filename}", issueH.GetAttachment)
	mux.HandleFunc("GET /api/v1/attachments/{id}", issueH.GetAttachment)
	mux.HandleFunc("GET /api/v1/issues/{key}/attachments/{filename}", issueH.GetIssueAttachment)

	// 4. 排期与规划
	mux.HandleFunc("GET /api/v1/planning/tree", planH.GetPlanningTree)
	mux.HandleFunc("GET /api/v1/planning/team", planH.GetTeamSwimlanes)
	mux.HandleFunc("POST /api/v1/planning/batch", planH.BatchUpdateSchedule)

	// 5. 工时
	mux.HandleFunc("GET /api/v1/worklogs/week", workH.GetWorklogWeek)
	mux.HandleFunc("GET /api/v1/worklogs/matrix", workH.GetWorklogMatrix)
	mux.HandleFunc("POST /api/v1/worklogs", workH.AddWorklog)

	// 6. 个人提醒与消息推送
	mux.HandleFunc("GET /api/v1/reminders/config", reminderH.GetConfig)
	mux.HandleFunc("PUT /api/v1/reminders/config", reminderH.SaveConfig)
	mux.HandleFunc("POST /api/v1/reminders/preview", reminderH.Preview)
	mux.HandleFunc("POST /api/v1/reminders/send-now", reminderH.SendNow)
	mux.HandleFunc("POST /api/v1/reminders/test", reminderH.TestChannels)

	// 7. SPA 静态文件托管
	spa := web.NewSPAServer()
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		spa.ServeHTTP(w, r)
	}))

	return corsMiddleware(mux)
}
