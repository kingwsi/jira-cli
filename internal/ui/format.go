package ui

import (
	"fmt"
)

func FormatDuration(seconds int) string {
	if seconds == 0 {
		return "-"
	}
	hours := float64(seconds) / 3600
	if hours >= 8 {
		days := hours / 8
		if days == float64(int(days)) {
			return fmt.Sprintf("%d天", int(days))
		}
		return fmt.Sprintf("%.1f天", days)
	}
	if hours == float64(int(hours)) {
		return fmt.Sprintf("%dh", int(hours))
	}
	return fmt.Sprintf("%.1fh", hours)
}
