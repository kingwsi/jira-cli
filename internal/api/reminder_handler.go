package api

import (
	"encoding/json"
	"net/http"

	"github.com/ws/jira-cli/internal/reminder"
)

type ReminderHandler struct {
	service *reminder.Service
}

func NewReminderHandler(service *reminder.Service) *ReminderHandler {
	return &ReminderHandler{service: service}
}

func (h *ReminderHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.service.GetConfig()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取提醒配置失败: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"code": 0, "data": cfg})
}

func (h *ReminderHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	var cfg reminder.Config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeError(w, http.StatusBadRequest, "提醒配置解析失败")
		return
	}
	saved, err := h.service.UpdateConfig(cfg)
	if err != nil {
		writeError(w, http.StatusBadRequest, "保存提醒配置失败: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"code": 0, "data": saved, "message": "提醒配置已保存"})
}

func (h *ReminderHandler) Preview(w http.ResponseWriter, r *http.Request) {
	report, message, err := h.service.Preview(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "检查提醒事件失败: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"code": 0, "data": map[string]any{"report": report, "message": message, "sent": false}})
}

func (h *ReminderHandler) SendNow(w http.ResponseWriter, r *http.Request) {
	report, message, err := h.service.SendNow(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, "发送提醒失败: "+err.Error())
		return
	}
	sent := !report.Empty()
	responseMessage := "检查完成，没有需要提醒的事项"
	if sent {
		responseMessage = "提醒检查与推送完成"
	}
	writeJSON(w, http.StatusOK, map[string]any{"code": 0, "data": map[string]any{"report": report, "message": message, "sent": sent}, "message": responseMessage})
}

func (h *ReminderHandler) TestChannels(w http.ResponseWriter, r *http.Request) {
	if err := h.service.TestChannels(r.Context()); err != nil {
		writeError(w, http.StatusBadGateway, "测试消息发送失败: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"code": 0, "message": "测试消息已发送"})
}
