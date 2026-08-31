//go:build !windows

package server

import (
	"fmt"
	"os/exec"
	"syscall"
)

func detach(cmd *exec.Cmd)     { cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true} }
func printStopCommand(pid int) { fmt.Printf("停止服务：kill %d\n", pid) }
