package reminder

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/ws/jira-cli/internal/jira"
)

type Service struct {
	mu     sync.Mutex
	sender *Sender
	now    func() time.Time
}

func NewService() *Service {
	return &Service{sender: NewSender(), now: time.Now}
}

func (s *Service) Start(ctx context.Context) {
	go func() {
		s.checkScheduled(ctx)
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.checkScheduled(ctx)
			}
		}
	}()
}

func (s *Service) checkScheduled(ctx context.Context) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := LoadConfig()
	if err != nil || !cfg.Enabled || !IsScheduledNow(cfg.Schedule, s.now()) {
		return
	}
	now := inScheduleLocation(s.now(), cfg.Schedule)
	if cfg.LastSent == now.Format("2006-01-02") {
		return
	}
	if _, _, err := s.run(ctx, &cfg, now, true); err != nil {
		log.Printf("提醒检查失败: %v", err)
	}
}

func (s *Service) Preview(ctx context.Context) (Report, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := LoadConfig()
	if err != nil {
		return Report{}, "", err
	}
	return s.run(ctx, &cfg, inScheduleLocation(s.now(), cfg.Schedule), false)
}

func (s *Service) SendNow(ctx context.Context) (Report, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := LoadConfig()
	if err != nil {
		return Report{}, "", err
	}
	return s.run(ctx, &cfg, inScheduleLocation(s.now(), cfg.Schedule), true)
}

func inScheduleLocation(now time.Time, schedule Schedule) time.Time {
	loc, err := time.LoadLocation(schedule.Timezone)
	if err != nil {
		return now
	}
	return now.In(loc)
}

func (s *Service) TestChannels(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := LoadConfig()
	if err != nil {
		return err
	}
	return s.send(ctx, cfg, "Jira Workbench 测试消息：消息通道配置成功。")
}

func (s *Service) GetConfig() (Config, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := LoadConfig()
	if err != nil {
		return Config{}, err
	}
	return PublicConfig(cfg), nil
}

func (s *Service) UpdateConfig(next Config) (Config, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := LoadConfig()
	if err != nil {
		return Config{}, err
	}
	next = MergeSecrets(next, current)
	if err := SaveConfig(next); err != nil {
		return Config{}, err
	}
	return PublicConfig(next), nil
}

func (s *Service) run(ctx context.Context, cfg *Config, now time.Time, send bool) (Report, string, error) {
	client, err := jira.NewClient()
	if err != nil {
		return Report{}, "", err
	}
	report, err := Check(client, now)
	if err != nil {
		return report, "", err
	}
	message := FormatReport(report)
	if !send {
		return report, message, nil
	}
	if report.Empty() {
		cfg.LastSent = now.Format("2006-01-02")
		return report, message, SaveConfig(*cfg)
	}
	if err := s.send(ctx, *cfg, message); err != nil {
		return report, message, err
	}
	cfg.LastSent = now.Format("2006-01-02")
	return report, message, SaveConfig(*cfg)
}

func (s *Service) send(ctx context.Context, cfg Config, message string) error {
	sent := 0
	var failures []string
	for _, channel := range cfg.Channels {
		if !channel.Enabled {
			continue
		}
		if err := s.sender.Send(ctx, channel, message); err != nil {
			failures = append(failures, fmt.Sprintf("%s: %v", channel.Name, err))
			continue
		}
		sent++
	}
	if sent == 0 {
		if len(failures) > 0 {
			return fmt.Errorf("所有消息通道发送失败: %v", failures)
		}
		return fmt.Errorf("没有启用的消息通道")
	}
	if len(failures) > 0 {
		log.Printf("部分消息通道发送失败: %v", failures)
	}
	return nil
}
