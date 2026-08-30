package reminder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Sender struct {
	client *http.Client
}

func NewSender() *Sender {
	return &Sender{client: &http.Client{Timeout: 15 * time.Second}}
}

func (s *Sender) Send(ctx context.Context, channel Channel, text string) error {
	switch channel.Type {
	case ChannelTelegram:
		return s.sendTelegram(ctx, channel, text)
	case ChannelWebhook:
		return s.sendWebhook(ctx, channel, text)
	default:
		return fmt.Errorf("不支持的通道类型 %q", channel.Type)
	}
}

func (s *Sender) sendTelegram(ctx context.Context, channel Channel, text string) error {
	endpoint := "https://api.telegram.org/bot" + url.PathEscape(channel.BotToken) + "/sendMessage"
	return s.postJSON(ctx, endpoint, map[string]any{"chat_id": channel.ChatID, "text": text, "disable_web_page_preview": true})
}

func (s *Sender) sendWebhook(ctx context.Context, channel Channel, text string) error {
	parsed, err := url.Parse(channel.WebhookURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return fmt.Errorf("Webhook URL 无效")
	}
	return s.postJSON(ctx, channel.WebhookURL, map[string]string{"text": text})
}

func (s *Sender) postJSON(ctx context.Context, endpoint string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return s.post(ctx, endpoint, "application/json", body)
}

func (s *Sender) post(ctx context.Context, endpoint, contentType string, body []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	resp, err := s.client.Do(req)
	if err != nil {
		if urlErr, ok := err.(*url.Error); ok {
			return fmt.Errorf("推送服务请求失败: %v", urlErr.Err)
		}
		return fmt.Errorf("推送服务请求失败")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("推送服务返回 %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return nil
}
