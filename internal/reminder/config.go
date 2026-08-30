package reminder

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/ws/jira-cli/internal/auth"
)

const (
	ScheduleLastWorkday = "last_workday_of_week"
	ScheduleWeekday     = "weekday"
	ChannelTelegram     = "telegram"
	ChannelWebhook      = "webhook"
)

type Config struct {
	Enabled  bool      `json:"enabled"`
	Schedule Schedule  `json:"schedule"`
	Channels []Channel `json:"channels"`
	LastSent string    `json:"lastSent,omitempty"`
}

type Schedule struct {
	Type     string `json:"type"`
	Weekday  int    `json:"weekday"` // 0=Sunday ... 6=Saturday
	Time     string `json:"time"`    // HH:mm
	Timezone string `json:"timezone"`
}

type Channel struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Type             string `json:"type"`
	Enabled          bool   `json:"enabled"`
	BotToken         string `json:"botToken,omitempty"`
	ChatID           string `json:"chatId,omitempty"`
	WebhookURL       string `json:"webhookUrl,omitempty"`
	SecretConfigured bool   `json:"secretConfigured,omitempty"`
}

func DefaultConfig() Config {
	return Config{
		Schedule: Schedule{Type: ScheduleLastWorkday, Time: "17:30", Timezone: "Asia/Shanghai"},
		Channels: []Channel{},
	}
}

func LoadConfig() (Config, error) {
	data, err := auth.LoadNotificationConfig()
	if err != nil {
		if os.IsNotExist(err) {
			return DefaultConfig(), nil
		}
		return Config{}, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, err
	}
	applyDefaults(&cfg)
	return cfg, nil
}

func SaveConfig(cfg Config) error {
	applyDefaults(&cfg)
	if err := ValidateConfig(cfg); err != nil {
		return err
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	return auth.SaveNotificationConfig(data)
}

func applyDefaults(cfg *Config) {
	if cfg.Schedule.Type == "" {
		cfg.Schedule.Type = ScheduleLastWorkday
	}
	if cfg.Schedule.Time == "" {
		cfg.Schedule.Time = "17:30"
	}
	if cfg.Schedule.Timezone == "" {
		cfg.Schedule.Timezone = "Asia/Shanghai"
	}
	if cfg.Channels == nil {
		cfg.Channels = []Channel{}
	}
}

func ValidateConfig(cfg Config) error {
	if cfg.Schedule.Type != ScheduleLastWorkday && cfg.Schedule.Type != ScheduleWeekday {
		return errors.New("不支持的提醒日期规则")
	}
	if cfg.Schedule.Weekday < 0 || cfg.Schedule.Weekday > 6 {
		return errors.New("weekday 必须在 0 到 6 之间")
	}
	if _, err := time.Parse("15:04", cfg.Schedule.Time); err != nil {
		return errors.New("提醒时间必须使用 HH:mm 格式")
	}
	if _, err := time.LoadLocation(cfg.Schedule.Timezone); err != nil {
		return errors.New("提醒时区无效")
	}
	seen := make(map[string]bool)
	for i, ch := range cfg.Channels {
		if strings.TrimSpace(ch.ID) == "" || seen[ch.ID] {
			return fmt.Errorf("第 %d 个消息通道缺少唯一 ID", i+1)
		}
		seen[ch.ID] = true
		if ch.Type != ChannelTelegram && ch.Type != ChannelWebhook {
			return fmt.Errorf("通道 %s 类型不受支持", ch.Name)
		}
		if !ch.Enabled {
			continue
		}
		if ch.Type == ChannelTelegram && (ch.BotToken == "" || ch.ChatID == "") {
			return fmt.Errorf("Telegram 通道 %s 缺少 Bot Token 或 Chat ID", ch.Name)
		}
		if ch.Type == ChannelWebhook && ch.WebhookURL == "" {
			return fmt.Errorf("Webhook 通道 %s 缺少 URL", ch.Name)
		}
	}
	return nil
}

func PublicConfig(cfg Config) Config {
	for i := range cfg.Channels {
		ch := &cfg.Channels[i]
		ch.SecretConfigured = ch.BotToken != "" || ch.WebhookURL != ""
		ch.BotToken = ""
		ch.WebhookURL = ""
	}
	return cfg
}

func MergeSecrets(next, current Config) Config {
	byID := make(map[string]Channel, len(current.Channels))
	for _, ch := range current.Channels {
		byID[ch.ID] = ch
	}
	for i := range next.Channels {
		old, ok := byID[next.Channels[i].ID]
		if !ok {
			continue
		}
		if next.Channels[i].BotToken == "" {
			next.Channels[i].BotToken = old.BotToken
		}
		if next.Channels[i].WebhookURL == "" {
			next.Channels[i].WebhookURL = old.WebhookURL
		}
	}
	next.LastSent = current.LastSent
	return next
}
