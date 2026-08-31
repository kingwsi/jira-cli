package server

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

const childEnv = "JIRA_BACKGROUND_CHILD"
const readyEnv = "JIRA_BACKGROUND_READY"

// Launch keeps normal invocations in the foreground; -open detaches a child.
func Launch(cfg Config) error {
	if !cfg.OpenBrowser || os.Getenv(childEnv) == "1" {
		return Run(cfg)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	logDir := filepath.Join(home, ".jira-workbench", "logs")
	if err := os.MkdirAll(logDir, 0700); err != nil {
		return err
	}
	logFile, err := os.CreateTemp(logDir, fmt.Sprintf("jira-%d-*.log", cfg.Port))
	if err != nil {
		return err
	}
	defer logFile.Close()
	readyDir, err := os.MkdirTemp("", "jira-start-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(readyDir)
	readyPath := filepath.Join(readyDir, "ready")
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Env = append(os.Environ(), childEnv+"=1", readyEnv+"="+readyPath)
	cmd.Stdout, cmd.Stderr = logFile, logFile
	detach(cmd)
	if err := cmd.Start(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	deadline := time.NewTimer(15 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(50 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case err := <-done:
			data, _ := os.ReadFile(logFile.Name())
			return fmt.Errorf("后台进程退出 (%v)，日志：%s\n%s", err, logFile.Name(), data)
		case <-deadline.C:
			_ = cmd.Process.Kill()
			<-done
			return fmt.Errorf("等待后台服务启动超时，已停止该进程；日志：%s", logFile.Name())
		case <-tick.C:
			if _, err := os.Stat(readyPath); err != nil {
				continue
			}
			data, _ := os.ReadFile(logFile.Name())
			fmt.Print(string(data))
			fmt.Printf("后台运行中，PID: %d\n日志：%s\n", cmd.Process.Pid, logFile.Name())
			printStopCommand(cmd.Process.Pid)
			return nil
		}
	}
}

func notifyReady() error {
	path := os.Getenv(readyEnv)
	// Restarted processes must not reuse the initial launch handshake.
	_ = os.Unsetenv(readyEnv)
	if path == "" {
		return nil
	}
	return os.WriteFile(path, []byte("ready\n"), 0600)
}
