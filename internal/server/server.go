package server

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/ws/jira-cli/internal/api"
	"github.com/ws/jira-cli/internal/reminder"
	"github.com/ws/jira-cli/internal/services"
	"github.com/ws/jira-cli/internal/updater"
)

type Config struct {
	Host        string
	Port        int
	OpenBrowser bool
	Version     string
}

func GetLocalIPs() []string {
	var ips []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return ips
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ip = ip.To4()
			if ip != nil {
				ips = append(ips, ip.String())
			}
		}
	}
	return ips
}

func OpenURLInBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default: // linux, bsd, etc.
		cmd = exec.Command("xdg-open", url)
	}
	go func() {
		if err := cmd.Run(); err != nil {
			fmt.Printf("无法自动打开浏览器，请手动访问 %s: %v\n", url, err)
		}
	}()
}

func Run(cfg Config) error {
	var addr string
	if cfg.Host == "0.0.0.0" || cfg.Host == "" {
		addr = fmt.Sprintf(":%d", cfg.Port)
	} else {
		addr = net.JoinHostPort(cfg.Host, fmt.Sprint(cfg.Port))
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("无法监听 %s: %w", addr, err)
	}
	defer listener.Close()

	serviceCtx, cancelService := context.WithCancel(context.Background())
	defer cancelService()
	holidayUpdater := services.NewHolidayUpdater()
	holidayUpdater.Start(serviceCtx)
	reminderService := reminder.NewService()
	reminderService.Start(serviceCtx)
	restart := make(chan struct{}, 1)
	updateService := updater.New(cfg.Version, func() { restart <- struct{}{} })
	router := api.NewRouter(reminderService, updateService)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 捕获系统退出信号实现优雅停机
	serverErrChan := make(chan error, 1)
	go func() {
		if err := httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			serverErrChan <- err
		}
	}()

	localHost := cfg.Host
	if localHost == "" || localHost == "0.0.0.0" || localHost == "::" {
		localHost = "localhost"
	}
	localURL := "http://" + net.JoinHostPort(localHost, fmt.Sprint(listener.Addr().(*net.TCPAddr).Port))

	fmt.Println("======================================================")
	fmt.Println("         🚀 Jira Workbench - Web 服务已启动")
	if cfg.Version != "" {
		fmt.Printf("         版本: %s\n", cfg.Version)
	}
	fmt.Println("======================================================")
	fmt.Printf("  • 本地访问:    %s\n", localURL)

	lanIPs := GetLocalIPs()
	if (cfg.Host == "0.0.0.0" || cfg.Host == "" || cfg.Host == "::") && len(lanIPs) > 0 {
		for _, ip := range lanIPs {
			fmt.Printf("  • 局域网访问:  http://%s:%d\n", ip, cfg.Port)
		}
	} else if cfg.Host == "0.0.0.0" || cfg.Host == "" {
		fmt.Printf("  • 局域网访问:  http://<LAN-IP>:%d\n", cfg.Port)
	}

	fmt.Printf("  • 监听绑定:    %s\n", addr)
	fmt.Println("------------------------------------------------------")
	if os.Getenv(childEnv) != "1" {
		fmt.Println("  按 Ctrl + C 即可停止服务")
	}
	fmt.Println("======================================================")
	fmt.Println()

	updateService.CheckAndNotify(serviceCtx, os.Stdout)
	if err := notifyReady(); err != nil {
		_ = httpServer.Close()
		return fmt.Errorf("通知启动结果失败: %w", err)
	}
	updateService.Start(serviceCtx)
	if cfg.OpenBrowser {
		OpenURLInBrowser(localURL)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(quit)

	select {
	case err := <-serverErrChan:
		return fmt.Errorf("HTTP 服务异常退出: %w", err)
	case <-restart:
		cancelService()
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			_ = httpServer.Close()
		}
		return updater.Restart()
	case sig := <-quit:
		fmt.Printf("\n收到信号 [%s]，正在停止服务...\n", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			return fmt.Errorf("服务停止出错: %w", err)
		}
		fmt.Println("服务已安全退出。")
	}

	return nil
}
