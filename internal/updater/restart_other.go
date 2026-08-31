//go:build !linux && !darwin

package updater

import "fmt"

func Restart() error { return fmt.Errorf("当前平台不支持自动重启") }
