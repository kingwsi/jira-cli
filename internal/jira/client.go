package jira

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/ws/jira-cli/internal/auth"
)

type Client struct {
	URL      string
	Username string
	Password string
	Client   *resty.Client
}

type AuthError struct {
	Message string
}

func (e *AuthError) Error() string {
	return e.Message
}

func NewClient() (*Client, error) {
	config, err := auth.LoadConfig()
	if err != nil || config == nil || config.URL == "" {
		return nil, &AuthError{Message: "未找到 Jira 认证信息，请在 Web 设置页面配置 Jira URL 与账号凭据"}
	}
	return createClient(config.URL, config.Username, config.Password)
}

func NewTestClient(url, username, password string) (*Client, error) {
	return createClient(url, username, password)
}

func createClient(url, username, password string) (*Client, error) {
	url = strings.TrimSuffix(url, "/")

	client := resty.New()
	client.SetBaseURL(url + "/rest/api/2/")

	encodedAuth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password)))

	client.SetHeader("Authorization", "Basic "+encodedAuth)
	client.SetHeader("Content-Type", "application/json")
	client.SetHeader("Accept", "application/json")
	client.SetHeader("X-Atlassian-Token", "no-check")
	client.SetTimeout(30 * time.Second)
	client.SetTLSClientConfig(&tls.Config{InsecureSkipVerify: true})

	return &Client{
		URL:      url,
		Username: username,
		Password: password,
		Client:   client,
	}, nil
}

func (c *Client) Validate() error {
	resp, err := c.Client.R().Get("myself")
	if err != nil {
		return fmt.Errorf("连接 Jira 服务器失败: %v", err)
	}

	if resp.StatusCode() == 401 {
		return &AuthError{Message: "认证失败：用户名或密码错误"}
	}

	if resp.IsError() {
		return fmt.Errorf("服务器返回错误 (%d): %s", resp.StatusCode(), resp.Status())
	}

	return nil
}

func (c *Client) handleResponse(resp *resty.Response, err error) error {
	if err != nil {
		return fmt.Errorf("请求执行失败: %v", err)
	}

	if resp.StatusCode() == 401 {
		return &AuthError{Message: "认证失效，请重新登录"}
	}

	if resp.IsError() {
		return fmt.Errorf("API 错误 [%d]: %s", resp.StatusCode(), resp.String())
	}

	return nil
}

// --- 模型结构 ---

type Issue struct {
	ID     string         `json:"id"`
	Key    string         `json:"key"`
	Fields RawIssueFields `json:"fields"`
}

type RawIssueFields struct {
	Summary              string         `json:"summary"`
	Description          string         `json:"description,omitempty"`
	Status               Status         `json:"status"`
	IssueType            IssueType      `json:"issuetype"`
	Priority             Priority       `json:"priority"`
	Assignee             *User          `json:"assignee"`
	Reporter             *User          `json:"reporter"`
	Created              string         `json:"created"`
	Updated              string         `json:"updated"`
	Labels               []string       `json:"labels,omitempty"`
	Project              ProjectShort   `json:"project"`
	TimeOriginalEstimate          int64          `json:"timeoriginalestimate,omitempty"`
	AggregateTimeOriginalEstimate int64          `json:"aggregatetimeoriginalestimate,omitempty"`
	TimeEstimate                  int64          `json:"timeestimate,omitempty"`
	TimeSpent                     int64          `json:"timespent,omitempty"`
	AggregateTimeSpent            int64          `json:"aggregatetimespent,omitempty"`
	ExpectedStart                 string         `json:"customfield_10300,omitempty"`
	ExpectedEnd          string         `json:"customfield_10301,omitempty"`
	Parent               *ParentRef     `json:"parent,omitempty"`
	Subtasks             []SubtaskRef   `json:"subtasks,omitempty"`
	FixVersions          []Version      `json:"fixVersions,omitempty"`
	ExtraFields          map[string]any `json:"-"`
}

func (f *RawIssueFields) UnmarshalJSON(data []byte) error {
	type Alias RawIssueFields
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(f),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var rawMap map[string]any
	if err := json.Unmarshal(data, &rawMap); err == nil {
		f.ExtraFields = rawMap
	}
	return nil
}

type ParentRef struct {
	ID     string `json:"id"`
	Key    string `json:"key"`
	Fields struct {
		Summary string `json:"summary"`
		Status  Status `json:"status"`
	} `json:"fields"`
}

type SubtaskRef struct {
	ID     string `json:"id"`
	Key    string `json:"key"`
	Fields struct {
		Summary   string    `json:"summary"`
		Status    Status    `json:"status"`
		IssueType IssueType `json:"issuetype"`
		Priority  Priority  `json:"priority"`
	} `json:"fields"`
}

type Version struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ReleaseDate string `json:"releaseDate,omitempty"`
}

type Status struct {
	ID             string          `json:"id,omitempty"`
	Name           string          `json:"name"`
	StatusCategory *StatusCategory `json:"statusCategory,omitempty"`
}

type StatusCategory struct {
	ID   int    `json:"id"`
	Key  string `json:"key"` // new, indeterminate, done
	Name string `json:"name"`
}

type IssueType struct {
	ID      string `json:"id,omitempty"`
	Name    string `json:"name"`
	Subtask bool   `json:"subtask,omitempty"`
}

type Priority struct {
	ID   string `json:"id,omitempty"`
	Name string `json:"name"`
}

type User struct {
	DisplayName  string            `json:"displayName"`
	Name         string            `json:"name,omitempty"`
	EmailAddress string            `json:"emailAddress,omitempty"`
	AccountID    string            `json:"accountId,omitempty"`
	Active       bool              `json:"active,omitempty"`
	AvatarURLs   map[string]string `json:"avatarUrls,omitempty"`
	AvatarURL    string            `json:"avatarUrl,omitempty"`
}

type Worklog struct {
	ID               string `json:"id"`
	IssueKey         string `json:"issueKey,omitempty"`
	Author           User   `json:"author"`
	UpdateAuthor     User   `json:"updateAuthor"`
	Comment          string `json:"comment"`
	Created          string `json:"created"`
	Updated          string `json:"updated"`
	Started          string `json:"started"`
	TimeSpent        string `json:"timeSpent"`
	TimeSpentSeconds int    `json:"timeSpentSeconds"`
}

type WorklogsResponse struct {
	StartAt    int       `json:"startAt"`
	MaxResults int       `json:"maxResults"`
	Total      int       `json:"total"`
	Worklogs   []Worklog `json:"worklogs"`
}

type ProjectShort struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

type SearchResponse struct {
	Issues []Issue `json:"issues"`
	Total  int     `json:"total"`
}

type Project struct {
	Key            string `json:"key"`
	Name           string `json:"name"`
	ProjectTypeKey string `json:"projectTypeKey"`
	Lead           User   `json:"lead"`
}

type FieldMeta struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Custom      bool     `json:"custom"`
	Navigable   bool     `json:"navigable"`
	Searchable  bool     `json:"searchable"`
	ClauseNames []string `json:"clauseNames"`
}

type Transition struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	To   Status `json:"to"`
}

type TransitionsResponse struct {
	Transitions []Transition `json:"transitions"`
}

// --- API 方法 ---

func (c *Client) GetIssue(key string) (*Issue, error) {
	var issue Issue
	resp, err := c.Client.R().SetResult(&issue).Get("issue/" + key)
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return &issue, nil
}

func (c *Client) Search(jql string, maxResults int) (*SearchResponse, error) {
	fields := []string{
		"summary", "description", "status", "issuetype", "priority",
		"assignee", "reporter", "created", "updated", "project",
		"timeoriginalestimate", "aggregatetimeoriginalestimate", "timeestimate", "timespent", "aggregatetimespent",
		"customfield_10300", "customfield_10301",
		"parent", "subtasks", "fixVersions",
	}
	return c.SearchAdvanced(jql, fields, maxResults)
}

func (c *Client) SearchAdvanced(jql string, fields []string, maxResults int) (*SearchResponse, error) {
	var result SearchResponse
	req := c.Client.R().
		SetQueryParams(map[string]string{
			"jql":        jql,
			"maxResults": fmt.Sprintf("%d", maxResults),
			"fields":     strings.Join(fields, ","),
		}).
		SetResult(&result)

	resp, err := req.Get("search")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return &result, nil
}

func (c *Client) Ping() (map[string]interface{}, error) {
	var result map[string]interface{}
	resp, err := c.Client.R().SetResult(&result).Get("serverInfo")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return result, nil
}

func (c *Client) UpdateIssue(issueKey string, fields map[string]interface{}) error {
	data := map[string]interface{}{
		"fields": fields,
	}

	resp, err := c.Client.R().
		SetBody(data).
		Put("issue/" + issueKey)

	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return apiErr
	}

	return nil
}

func (c *Client) CreateIssue(project, summary, issueType, description, parentKey string) (*Issue, error) {
	var result Issue
	fields := map[string]interface{}{
		"project":   map[string]string{"key": project},
		"summary":   summary,
		"issuetype": map[string]string{"name": issueType},
	}
	if description != "" {
		fields["description"] = description
	}
	if parentKey != "" {
		fields["parent"] = map[string]string{"key": parentKey}
	}

	data := map[string]interface{}{
		"fields": fields,
	}

	resp, err := c.Client.R().SetBody(data).SetResult(&result).Post("issue")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return &result, nil
}

func (c *Client) ListProjects() ([]Project, error) {
	var projects []Project
	resp, err := c.Client.R().SetResult(&projects).Get("project")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return projects, nil
}

func (c *Client) GetCurrentUser() (*User, error) {
	var user User
	resp, err := c.Client.R().SetResult(&user).Get("myself")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return &user, nil
}

func (c *Client) GetFields() ([]FieldMeta, error) {
	var fields []FieldMeta
	resp, err := c.Client.R().SetResult(&fields).Get("field")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return fields, nil
}

func (c *Client) GetTransitions(issueKey string) ([]Transition, error) {
	var result TransitionsResponse
	resp, err := c.Client.R().SetResult(&result).Get("issue/" + issueKey + "/transitions")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return result.Transitions, nil
}

func (c *Client) DoTransition(issueKey, transitionID string) error {
	data := map[string]interface{}{
		"transition": map[string]string{
			"id": transitionID,
		},
	}
	resp, err := c.Client.R().SetBody(data).Post("issue/" + issueKey + "/transitions")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return apiErr
	}
	return nil
}

func (c *Client) AddWorklog(issueKey, timeSpent, comment, started string) error {
	if started == "" {
		started = time.Now().Format("2006-01-02T15:04:05.000-0700")
	} else if t, err := time.ParseInLocation("2006-01-02", started, time.Local); err == nil && len(started) == 10 {
		// 仅传日期时，补充为 Jira 要求的完整时间戳格式 (当天 09:00 本地时间)
		started = t.Format("2006-01-02") + "T09:00:00.000+0800"
	}
	data := map[string]interface{}{
		"timeSpent": timeSpent,
		"started":   started,
	}
	if comment != "" {
		data["comment"] = comment
	}

	resp, err := c.Client.R().
		SetBody(data).
		Post("issue/" + issueKey + "/worklog")

	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return apiErr
	}
	return nil
}

func (c *Client) AddComment(issueKey, comment string) error {
	comment = strings.TrimSpace(comment)
	if comment == "" {
		return nil
	}
	data := map[string]interface{}{
		"body": comment,
	}
	resp, err := c.Client.R().
		SetBody(data).
		Post("issue/" + issueKey + "/comment")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return apiErr
	}
	return nil
}

func (c *Client) GetWorklogs(issueKey string) ([]Worklog, error) {
	var result WorklogsResponse
	resp, err := c.Client.R().
		SetResult(&result).
		Get("issue/" + issueKey + "/worklog")

	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return result.Worklogs, nil
}

func (c *Client) GetIssueTypes() ([]IssueType, error) {
	var issueTypes []IssueType
	resp, err := c.Client.R().SetResult(&issueTypes).Get("issuetype")
	if apiErr := c.handleResponse(resp, err); apiErr != nil {
		return nil, apiErr
	}
	return issueTypes, nil
}

func (c *Client) SearchUsers(query string) ([]User, error) {
	query = strings.TrimSpace(query)

	// Jira Server/Data Center 的 user/picker 同时匹配显示姓名和用户名。
	// user/search 的 username 参数在很多版本中只匹配登录名，因此只作回退。
	var pickerResult struct {
		Users []User `json:"users"`
	}
	pickerResp, pickerErr := c.Client.R().
		SetResult(&pickerResult).
		SetQueryParams(map[string]string{
			"query":      query,
			"maxResults": "50",
			"showAvatar": "true",
		}).
		Get("user/picker")
	if pickerErr == nil && !pickerResp.IsError() {
		return pickerResult.Users, nil
	}

	var users []User
	username := query
	if username == "" {
		username = "%"
	}
	searchResp, searchErr := c.Client.R().
		SetResult(&users).
		SetQueryParams(map[string]string{
			"username":        username,
			"maxResults":      "50",
			"includeActive":   "true",
			"includeInactive": "false",
		}).
		Get("user/search")
	if apiErr := c.handleResponse(searchResp, searchErr); apiErr != nil {
		if pickerErr != nil {
			return nil, fmt.Errorf("用户选择器请求失败: %v; 用户搜索回退失败: %w", pickerErr, apiErr)
		}
		return nil, fmt.Errorf("用户选择器 API 错误 [%d]: %s; 用户搜索回退失败: %w", pickerResp.StatusCode(), pickerResp.String(), apiErr)
	}
	return users, nil
}
