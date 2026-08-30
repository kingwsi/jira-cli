package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const holidaySourceURL = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/%d.json"

type holidayCalendar struct {
	Year int          `json:"year"`
	Days []holidayDay `json:"days"`
}

type holidayDay struct {
	Name     string `json:"name"`
	Date     string `json:"date"`
	IsOffDay bool   `json:"isOffDay"`
}

type HolidayUpdater struct {
	client   *http.Client
	cacheDir string
	now      func() time.Time
}

func NewHolidayUpdater() *HolidayUpdater {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	return &HolidayUpdater{
		client:   &http.Client{Timeout: 15 * time.Second},
		cacheDir: filepath.Join(home, ".jira-workbench-holidays"),
		now:      time.Now,
	}
}

// Start loads the local cache immediately, refreshes it in the background at
// startup, and then refreshes every 24 hours while the service is running.
func (u *HolidayUpdater) Start(ctx context.Context) {
	// Load persisted data before reminder scheduling starts, so startup checks do
	// not temporarily fall back to weekday-only rules.
	u.loadRelevantCaches()
	go func() {
		u.refreshRelevantYears(ctx)
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				u.refreshRelevantYears(ctx)
			}
		}
	}()
}

func (u *HolidayUpdater) loadRelevantCaches() {
	year := u.now().Year()
	for _, candidate := range []int{year - 1, year, year + 1} {
		if err := u.LoadCache(candidate); err != nil && !os.IsNotExist(err) {
			log.Printf("加载 %d 年节假日缓存失败: %v", candidate, err)
		}
	}
}

func (u *HolidayUpdater) refreshRelevantYears(ctx context.Context) {
	year := u.now().Year()
	for _, candidate := range []int{year, year + 1} {
		if err := u.Refresh(ctx, candidate); err != nil {
			log.Printf("更新 %d 年节假日数据失败，继续使用本地或内置数据: %v", candidate, err)
		}
	}
}

func (u *HolidayUpdater) Refresh(ctx context.Context, year int) error {
	if year < 2000 || year > 2200 {
		return fmt.Errorf("年份 %d 超出支持范围", year)
	}
	endpoint := fmt.Sprintf(holidaySourceURL, year)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	resp, err := u.client.Do(req)
	if err != nil {
		return fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("数据源返回 HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return fmt.Errorf("读取响应失败: %w", err)
	}
	calendar, err := parseHolidayCalendar(body, year)
	if err != nil {
		return err
	}
	if err := u.writeCache(year, body); err != nil {
		return fmt.Errorf("保存缓存失败: %w", err)
	}
	applyHolidayCalendar(calendar)
	log.Printf("已更新 %d 年节假日数据，共 %d 条官方覆盖", year, len(calendar.Days))
	return nil
}

func (u *HolidayUpdater) LoadCache(year int) error {
	body, err := os.ReadFile(u.cachePath(year))
	if err != nil {
		return err
	}
	calendar, err := parseHolidayCalendar(body, year)
	if err != nil {
		return err
	}
	applyHolidayCalendar(calendar)
	return nil
}

func (u *HolidayUpdater) writeCache(year int, body []byte) error {
	if err := os.MkdirAll(u.cacheDir, 0700); err != nil {
		return err
	}
	temp, err := os.CreateTemp(u.cacheDir, ".holiday-*.json")
	if err != nil {
		return err
	}
	tempName := temp.Name()
	defer os.Remove(tempName)
	if err := temp.Chmod(0600); err != nil {
		_ = temp.Close()
		return err
	}
	if _, err := temp.Write(body); err != nil {
		_ = temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempName, u.cachePath(year))
}

func (u *HolidayUpdater) cachePath(year int) string {
	return filepath.Join(u.cacheDir, strconv.Itoa(year)+".json")
}

func parseHolidayCalendar(body []byte, expectedYear int) (holidayCalendar, error) {
	var calendar holidayCalendar
	if err := json.Unmarshal(body, &calendar); err != nil {
		return holidayCalendar{}, fmt.Errorf("节假日 JSON 无效: %w", err)
	}
	if calendar.Year != expectedYear {
		return holidayCalendar{}, fmt.Errorf("数据年份为 %d，期望 %d", calendar.Year, expectedYear)
	}
	if len(calendar.Days) == 0 {
		return holidayCalendar{}, fmt.Errorf("节假日数据为空")
	}
	prefix := strconv.Itoa(expectedYear) + "-"
	seen := make(map[string]bool, len(calendar.Days))
	for _, day := range calendar.Days {
		if !strings.HasPrefix(day.Date, prefix) {
			return holidayCalendar{}, fmt.Errorf("日期 %q 不属于 %d 年", day.Date, expectedYear)
		}
		if _, err := time.Parse("2006-01-02", day.Date); err != nil {
			return holidayCalendar{}, fmt.Errorf("日期 %q 格式无效", day.Date)
		}
		if seen[day.Date] {
			return holidayCalendar{}, fmt.Errorf("日期 %q 重复", day.Date)
		}
		seen[day.Date] = true
	}
	return calendar, nil
}
