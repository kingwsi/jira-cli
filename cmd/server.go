package cmd

import (
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/pterm/pterm"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/api"
)

var (
	serverHost = "0.0.0.0"
	serverPort = 8080
)

func getLocalIPs() []string {
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

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "启动 Jira Web 工作台服务 (支持局域网访问)",
	Long:  `启动 Jira Server，提供任务查看、团队排期甘特图、工时填报等可视化 Web 界面与 API 服务。默认绑定 0.0.0.0 允许局域网设备访问。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		var addr string
		if serverHost == "0.0.0.0" || serverHost == "" {
			addr = fmt.Sprintf(":%d", serverPort)
		} else {
			addr = fmt.Sprintf("%s:%d", serverHost, serverPort)
		}

		pterm.DefaultHeader.WithFullWidth().Println("Jira Workbench - Web 服务已启动")

		localURL := fmt.Sprintf("http://localhost:%d", serverPort)
		pterm.Info.Printf("本地访问:   %s\n", pterm.LightCyan(localURL))

		lanIPs := getLocalIPs()
		if len(lanIPs) > 0 {
			for _, ip := range lanIPs {
				lanURL := fmt.Sprintf("http://%s:%d", ip, serverPort)
				pterm.Info.Printf("局域网访问: %s\n", pterm.LightGreen(lanURL))
			}
		} else if serverHost == "0.0.0.0" || serverHost == "" {
			pterm.Info.Printf("局域网访问: http://<你的局域网IP>:%d\n", serverPort)
		}

		pterm.Println()
		pterm.Info.Printf("监听绑定:   %s (全部网卡 0.0.0.0)\n", addr)
		pterm.Info.Println("按 Ctrl + C 即可退出服务")
		pterm.Println()

		router := api.NewRouter()
		server := &http.Server{
			Addr:         addr,
			Handler:      router,
			ReadTimeout:  60 * time.Second,
			WriteTimeout: 60 * time.Second,
		}

		return server.ListenAndServe()
	},
}

func init() {
	serverCmd.Flags().StringVarP(&serverHost, "host", "H", "0.0.0.0", "服务监听 Host (0.0.0.0 允许局域网访问)")
	serverCmd.Flags().IntVarP(&serverPort, "port", "p", 8080, "服务监听端口")
	rootCmd.AddCommand(serverCmd)
}
