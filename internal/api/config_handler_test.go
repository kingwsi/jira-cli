package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ws/jira-cli/internal/auth"
	"github.com/ws/jira-cli/internal/models"
	"github.com/zalando/go-keyring"
)

func TestConfigurationRequiresCompleteCredentials(t *testing.T) {
	keyring.MockInit()
	t.Cleanup(keyring.MockInit)
	t.Setenv("HOME", t.TempDir())
	for _, tc := range []struct {
		name  string
		cfg   auth.Config
		ready bool
	}{
		{"empty", auth.Config{}, false},
		{"url only", auth.Config{URL: "https://jira.example"}, false},
		{"missing password", auth.Config{URL: "https://jira.example", Username: "user"}, false},
		{"blank user", auth.Config{URL: "https://jira.example", Username: " ", Password: "secret-token"}, false},
		{"complete", auth.Config{URL: "https://jira.example", Username: "user", Password: "secret-token"}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := auth.SaveConfig(tc.cfg); err != nil {
				t.Fatal(err)
			}
			recorder := httptest.NewRecorder()
			NewConfigHandler(nil).GetConfig(recorder, httptest.NewRequest("GET", "/api/v1/config", nil))
			var response struct {
				Data models.ServerConfig `json:"data"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response.Data.IsConfigured != tc.ready {
				t.Fatalf("configured = %v, want %v", response.Data.IsConfigured, tc.ready)
			}
			if response.Data.URL != tc.cfg.URL {
				t.Fatal("partial config must remain editable")
			}
			if strings.Contains(recorder.Body.String(), "secret-token") {
				t.Fatal("credentials leaked")
			}
		})
	}
}
