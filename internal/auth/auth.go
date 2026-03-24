package auth

import (
	"encoding/json"

	"github.com/zalando/go-keyring"
)

const (
	serviceName = "ws-jira-cli-tool-v1"
	accountName = "current-user"
)

type Config struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func SaveConfig(config Config) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	return keyring.Set(serviceName, accountName, string(data))
}

func LoadConfig() (*Config, error) {
	data, err := keyring.Get(serviceName, accountName)
	if err != nil {
		return nil, err
	}

	var config Config
	if err := json.Unmarshal([]byte(data), &config); err != nil {
		return nil, err
	}
	return &config, nil
}

func DeleteConfig() error {
	err := keyring.Delete(serviceName, accountName)
	if err != nil && err != keyring.ErrNotFound {
		return err
	}
	return nil
}

func HasConfig() bool {
	_, err := keyring.Get(serviceName, accountName)
	return err == nil
}
