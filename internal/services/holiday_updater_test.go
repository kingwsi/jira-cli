package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

type holidayRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn holidayRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestHolidayUpdaterRefreshAndCacheFallback(t *testing.T) {
	const year = 2099
	weekday, weekend := findWeekdayAndWeekend(year)
	payload := fmt.Sprintf(`{"year":%d,"days":[{"name":"测试放假","date":"%s","isOffDay":true},{"name":"测试补班","date":"%s","isOffDay":false}]}`, year, weekday.Format("2006-01-02"), weekend.Format("2006-01-02"))

	updater := NewHolidayUpdater()
	updater.cacheDir = t.TempDir()
	updater.client.Transport = holidayRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		if !strings.HasSuffix(request.URL.Path, "/2099.json") {
			t.Fatalf("unexpected source URL: %s", request.URL)
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(payload)), Header: make(http.Header)}, nil
	})

	if err := updater.Refresh(context.Background(), year); err != nil {
		t.Fatal(err)
	}
	if IsChinaWorkday(weekday) {
		t.Fatal("weekday holiday override was not applied")
	}
	if !IsChinaWorkday(weekend) {
		t.Fatal("weekend make-up workday override was not applied")
	}
	info, err := os.Stat(updater.cachePath(year))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("cache permissions = %o", info.Mode().Perm())
	}

	holidayOverridesMu.Lock()
	delete(holidayOverrides, year)
	holidayOverridesMu.Unlock()
	if err := updater.LoadCache(year); err != nil {
		t.Fatal(err)
	}
	if IsChinaWorkday(weekday) || !IsChinaWorkday(weekend) {
		t.Fatal("cached overrides were not restored")
	}
}

func TestParseHolidayCalendarRejectsWrongYear(t *testing.T) {
	_, err := parseHolidayCalendar([]byte(`{"year":2098,"days":[{"date":"2098-01-01","isOffDay":true}]}`), 2099)
	if err == nil {
		t.Fatal("expected a year validation error")
	}
}

func findWeekdayAndWeekend(year int) (time.Time, time.Time) {
	var weekday, weekend time.Time
	for day := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC); day.Year() == year; day = day.AddDate(0, 0, 1) {
		if weekday.IsZero() && day.Weekday() >= time.Monday && day.Weekday() <= time.Friday {
			weekday = day
		}
		if weekend.IsZero() && (day.Weekday() == time.Saturday || day.Weekday() == time.Sunday) {
			weekend = day
		}
		if !weekday.IsZero() && !weekend.IsZero() {
			return weekday, weekend
		}
	}
	return weekday, weekend
}
