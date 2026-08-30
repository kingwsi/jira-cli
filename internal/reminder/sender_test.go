package reminder

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestGenericWebhookPayload(t *testing.T) {
	sender := NewSender()
	sender.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("content type = %q", got)
		}
		body, _ := io.ReadAll(r.Body)
		assertJSONPath("text", "hello")(t, body)
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("ok")), Header: make(http.Header)}, nil
	})
	if err := sender.Send(context.Background(), Channel{Type: ChannelWebhook, WebhookURL: "https://example.test/hook"}, "hello"); err != nil {
		t.Fatal(err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func assertJSONPath(key, expected string) func(*testing.T, []byte) {
	return func(t *testing.T, body []byte) {
		var value map[string]any
		if err := json.Unmarshal(body, &value); err != nil {
			t.Fatal(err)
		}
		if value[key] != expected {
			t.Fatalf("%s = %#v", key, value[key])
		}
	}
}
