package server

import (
	"fmt"
	"os/exec"
	"syscall"
)

func detach(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000008 | 0x00000200}
}
func printStopCommand(pid int) { fmt.Printf("停止服务：taskkill /PID %d\n", pid) }
