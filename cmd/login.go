package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/ws/jira-cli/internal/auth"
	"github.com/ws/jira-cli/internal/jira"
	"golang.org/x/term"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "登录并安全地将凭据存储在系统钥匙串中。",
	RunE: func(cmd *cobra.Command, args []string) error {
		reader := bufio.NewReader(os.Stdin)

		fmt.Print("Jira URL (例如 https://jira.company.com): ")
		url, _ := reader.ReadString('\n')
		url = strings.TrimSpace(url)

		fmt.Print("用户名: ")
		username, _ := reader.ReadString('\n')
		username = strings.TrimSpace(username)

		fmt.Print("密码/API Token (输入时不会显示): ")
		fd := int(os.Stdin.Fd())
		bytePassword, err := term.ReadPassword(fd)
		if err != nil {
			return err
		}
		password := string(bytePassword)
		fmt.Println()

		if url == "" || username == "" || password == "" {
			return fmt.Errorf("所有字段均为必填项")
		}

		fmt.Printf("正在验证凭据并连接 %s...\n", url)
		
		config := auth.Config{
			URL:      url,
			Username: username,
			Password: password,
		}

		testClient, err := jira.NewTestClient(config.URL, config.Username, config.Password)
		if err != nil {
			return fmt.Errorf("初始化失败: %v", err)
		}

		if err := testClient.Validate(); err != nil {
			return err
		}

		err = auth.SaveConfig(config)
		if err != nil {
			return fmt.Errorf("保存到钥匙串失败: %v", err)
		}

		color.Green("✓ 验证成功！凭据已安全存储。")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(loginCmd)
}
