package storage

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type UserHistoryItem struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Count       int    `json:"count"`
	LastUsed    int64  `json:"lastUsed"`
}

type UserHistoryStore struct {
	db *sql.DB
}

var (
	defaultStore *UserHistoryStore
	storeOnce    sync.Once
)

func getDatabasePath() string {
	// 1. 如果 Docker 挂载了 /data 目录，存储在 /data/jira_workbench.db
	if fi, err := os.Stat("/data"); err == nil && fi.IsDir() {
		return "/data/jira_workbench.db"
	}
	// 2. 否则使用用户主目录下的 ~/.jira-workbench.db
	home, err := os.UserHomeDir()
	if err != nil {
		return ".jira-workbench.db"
	}
	return filepath.Join(home, ".jira-workbench.db")
}

func GetUserHistoryStore() *UserHistoryStore {
	storeOnce.Do(func() {
		dbPath := getDatabasePath()
		db, err := sql.Open("sqlite", dbPath)
		if err != nil {
			panic("无法连接本地 SQLite 数据库: " + err.Error())
		}

		// 初始化 SQLite 表结构与索引
		createTableSQL := `
		CREATE TABLE IF NOT EXISTS user_history (
			name TEXT PRIMARY KEY,
			display_name TEXT NOT NULL,
			count INTEGER NOT NULL DEFAULT 1,
			last_used INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_user_history_count ON user_history(count DESC, last_used DESC);
		`
		if _, err := db.Exec(createTableSQL); err != nil {
			panic("初始化 SQLite user_history 数据表失败: " + err.Error())
		}

		defaultStore = &UserHistoryStore{db: db}
	})
	return defaultStore
}

func (s *UserHistoryStore) GetHistory(limit int) []UserHistoryItem {
	if limit <= 0 {
		limit = 10
	}

	query := `
	SELECT name, display_name, count, last_used
	FROM user_history
	ORDER BY count DESC, last_used DESC
	LIMIT ?
	`
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return []UserHistoryItem{}
	}
	defer rows.Close()

	items := make([]UserHistoryItem, 0, limit)
	for rows.Next() {
		var item UserHistoryItem
		if err := rows.Scan(&item.Name, &item.DisplayName, &item.Count, &item.LastUsed); err == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *UserHistoryStore) RecordUser(name, displayName string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil
	}
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		displayName = name
	}

	now := time.Now().UnixMilli()

	upsertSQL := `
	INSERT INTO user_history (name, display_name, count, last_used)
	VALUES (?, ?, 1, ?)
	ON CONFLICT(name) DO UPDATE SET
		count = count + 1,
		last_used = excluded.last_used,
		display_name = CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE display_name END;
	`
	_, err := s.db.Exec(upsertSQL, name, displayName, now)
	return err
}
