package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/ws/jira-cli/internal/storage"
)

type UserHistoryHandler struct {
	store *storage.UserHistoryStore
}

func NewUserHistoryHandler() *UserHistoryHandler {
	return &UserHistoryHandler{
		store: storage.GetUserHistoryStore(),
	}
}

func (h *UserHistoryHandler) GetUserHistory(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 10
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}

	items := h.store.GetHistory(limit)
	writeJSON(w, http.StatusOK, items)
}

type recordUserRequest struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
}

func (h *UserHistoryHandler) RecordUserHistory(w http.ResponseWriter, r *http.Request) {
	var req recordUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "用户标识 name 不能为空")
		return
	}

	if err := h.store.RecordUser(req.Name, req.DisplayName); err != nil {
		writeError(w, http.StatusInternalServerError, "保存用户历史失败: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}
