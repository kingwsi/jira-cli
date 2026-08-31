package api

import (
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/ws/jira-cli/internal/updater"
)

func registerUpdates(mux *http.ServeMux, s *updater.Service) {
	respond := func(w http.ResponseWriter) { writeJSON(w, 200, map[string]any{"code": 0, "data": s.Status()}) }
	mux.HandleFunc("GET /api/v1/updates", func(w http.ResponseWriter, r *http.Request) { respond(w) })
	// Installation and persisted policy changes are local administration operations.
	guard := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			requestHost := r.Host
			if h, _, err := net.SplitHostPort(requestHost); err == nil {
				requestHost = h
			}
			requestIP := net.ParseIP(requestHost)
			if requestHost != "localhost" && (requestIP == nil || !requestIP.IsLoopback()) {
				writeError(w, 403, "请使用 localhost 或回环地址管理更新")
				return
			}
			host, _, _ := net.SplitHostPort(r.RemoteAddr)
			if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
				writeError(w, 403, "请从服务所在机器访问设置以管理更新")
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" {
				u, err := url.Parse(origin)
				if err != nil || u.Host != r.Host {
					writeError(w, 403, "不允许跨域更新操作")
					return
				}
			}
			if r.Header.Get("Content-Type") != "application/json" {
				writeError(w, 415, "需要 application/json")
				return
			}
			next(w, r)
		}
	}
	mux.HandleFunc("POST /api/v1/updates/check", guard(func(w http.ResponseWriter, r *http.Request) {
		if err := s.Check(r.Context()); err != nil {
			writeError(w, 502, err.Error())
			return
		}
		respond(w)
	}))
	mux.HandleFunc("PUT /api/v1/updates/config", guard(func(w http.ResponseWriter, r *http.Request) {
		var cfg struct {
			Auto bool `json:"auto"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&cfg); err != nil {
			writeError(w, 400, "无效的更新配置")
			return
		}
		if err := s.SetAuto(cfg.Auto); err != nil {
			writeError(w, 400, err.Error())
			return
		}
		respond(w)
	}))
	mux.HandleFunc("POST /api/v1/updates/install", guard(func(w http.ResponseWriter, r *http.Request) {
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(4 * time.Minute))
		if err := s.Install(r.Context()); err != nil {
			writeError(w, 409, err.Error())
			return
		}
		respond(w)
	}))
}
