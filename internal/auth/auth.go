package auth

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/zalando/go-keyring"
)

const (
	serviceName             = "jira-workbench"
	legacyServiceName       = "ws-jira-cli-tool-v1"
	accountName             = "current-user"
	notificationAccountName = "notifications"
)

type Config struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func getConfigFilePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".jira-workbench.json"
	}
	return filepath.Join(home, ".jira-workbench.json")
}

func getNotificationConfigFilePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".jira-workbench-notifications.json"
	}
	return filepath.Join(home, ".jira-workbench-notifications.json")
}

func SaveConfig(config Config) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	// 尝试优先存储在操作系统安全钥匙串
	if err := keyring.Set(serviceName, accountName, string(data)); err == nil {
		return nil
	}

	// 如果系统不支持 keyring（如无图形界面的服务器/容器），降级存储至用户主目录配置文件
	return os.WriteFile(getConfigFilePath(), data, 0600)
}

func LoadConfig() (*Config, error) {
	// 1. 尝试从主服务名 keyring 获取
	data, err := keyring.Get(serviceName, accountName)
	if err != nil {
		// 2. 尝试从历史 CLI 服务名 keyring 获取（兼容旧版数据）
		data, err = keyring.Get(legacyServiceName, accountName)
	}

	// 3. 如果 keyring 获取失败，降级从主目录配置文件读取
	if err != nil {
		fileData, fileErr := os.ReadFile(getConfigFilePath())
		if fileErr != nil {
			return nil, err
		}
		data = string(fileData)
	}

	var config Config
	if err := json.Unmarshal([]byte(data), &config); err != nil {
		return nil, err
	}
	return &config, nil
}

func DeleteConfig() error {
	_ = keyring.Delete(serviceName, accountName)
	_ = keyring.Delete(legacyServiceName, accountName)
	_ = os.Remove(getConfigFilePath())
	return nil
}

func HasConfig() bool {
	cfg, err := LoadConfig()
	return err == nil && cfg != nil && cfg.URL != ""
}

// SaveNotificationConfig stores notification credentials separately from Jira credentials.
// Telegram tokens and webhook URLs may contain secrets, so they use the keyring when available
// and a permission-restricted file as the server/container fallback.
func SaveNotificationConfig(data []byte) error {
	if err := keyring.Set(serviceName, notificationAccountName, string(data)); err == nil {
		return nil
	}
	return os.WriteFile(getNotificationConfigFilePath(), data, 0600)
}

func LoadNotificationConfig() ([]byte, error) {
	data, err := keyring.Get(serviceName, notificationAccountName)
	if err == nil {
		return []byte(data), nil
	}
	return os.ReadFile(getNotificationConfigFilePath())
}
