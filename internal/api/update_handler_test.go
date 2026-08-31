package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ws/jira-cli/internal/updater"
)

func TestUpdateManagementBoundary(t *testing.T) {
	mux := http.NewServeMux()
	registerUpdates(mux, updater.New("dev", func() {}))
	for _, tc := range []struct {
		remote, origin, content string
		want                    int
	}{
		{"192.168.1.2:1234", "", "application/json", 403},
		{"127.0.0.1:1234", "https://evil.example", "application/json", 403},
		{"127.0.0.1:1234", "", "text/plain", 415},
		{"127.0.0.1:1234", "http://localhost", "application/json", 400},
	} {
		req := httptest.NewRequest("PUT", "http://localhost/api/v1/updates/config", strings.NewReader("invalid"))
		req.RemoteAddr = tc.remote
		req.Header.Set("Origin", tc.origin)
		req.Header.Set("Content-Type", tc.content)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Errorf("%+v: got %d", tc, w.Code)
		}
	}
}
