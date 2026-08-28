package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/ws/jira-cli/internal/auth"
	"github.com/ws/jira-cli/internal/jira"
	"github.com/ws/jira-cli/internal/models"
)

const fieldsCacheTTL = 24 * time.Hour

type ConfigHandler struct {
	cache *memoryCache
}

func NewConfigHandler(cache *memoryCache) *ConfigHandler {
	return &ConfigHandler{cache: cache}
}

func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, _ := auth.LoadConfig()
	isConfigured := cfg != nil && cfg.URL != ""

	resp := models.ServerConfig{
		IsConfigured:         isConfigured,
		CustomFieldStartDate: "customfield_10300",
		CustomFieldEndDate:   "customfield_10301",
		DefaultProject:       "DSYFB",
	}

	if isConfigured {
		resp.URL = cfg.URL
		resp.Username = cfg.Username
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code": 0,
		"data": resp,
	})
}

func (h *ConfigHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数解析失败")
		return
	}

	if req.URL == "" || req.Username == "" {
		writeError(w, http.StatusBadRequest, "URL 和 用户名 不能为空")
		return
	}

	// 如果未传 password，但已保存过，则复用原有 password
	if req.Password == "" {
		existing, _ := auth.LoadConfig()
		if existing != nil && existing.Password != "" {
			req.Password = existing.Password
		}
	}

	// 验证连通性
	client, err := jira.NewTestClient(req.URL, req.Username, req.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, "创建 Jira 客户端失败: "+err.Error())
		return
	}

	if err := client.Validate(); err != nil {
		writeError(w, http.StatusUnauthorized, "Jira 连通性测试失败: "+err.Error())
		return
	}

	if err := auth.SaveConfig(auth.Config{
		URL:      req.URL,
		Username: req.Username,
		Password: req.Password,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "保存配置失败: "+err.Error())
		return
	}
	h.cache.Clear()

	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "配置保存成功且测试连接通过",
	})
}

func (h *ConfigHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL      string `json:"url"`
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数解析失败")
		return
	}

	if req.Password == "" {
		existing, _ := auth.LoadConfig()
		if existing != nil && existing.Password != "" {
			req.Password = existing.Password
		}
	}

	client, err := jira.NewTestClient(req.URL, req.Username, req.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, "创建客户端失败: "+err.Error())
		return
	}

	user, err := client.GetCurrentUser()
	if err != nil {
		writeError(w, http.StatusUnauthorized, "连接失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":    0,
		"message": "连接成功",
		"data":    user,
	})
}

func (h *ConfigHandler) GetFields(w http.ResponseWriter, r *http.Request) {
	if cached, ok := h.cache.Get("fields"); ok {
		writeJSON(w, http.StatusOK, map[string]any{
			"code": 0,
			"data": cached,
		})
		return
	}

	client, err := jira.NewClient()
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	fields, err := client.GetFields()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取 Jira 字段列表失败: "+err.Error())
		return
	}
	h.cache.Set("fields", fields, fieldsCacheTTL)

	writeJSON(w, http.StatusOK, map[string]any{
		"code": 0,
		"data": fields,
	})
}
