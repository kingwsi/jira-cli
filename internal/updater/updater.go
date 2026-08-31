package updater

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"regexp"
	"strconv"
)

const source = "https://nextx.uk/jira-work/latest/version.json"

type Release struct {
	Version   string            `json:"version"`
	BuiltAt   string            `json:"built_at"`
	Checksums map[string]string `json:"checksums"`
}
type Status struct {
	Current   string `json:"current"`
	Latest    string `json:"latest"`
	Available bool   `json:"available"`
	Auto      bool   `json:"auto"`
	Supported bool   `json:"supported"`
	Reason    string `json:"reason"`
	Busy      bool   `json:"busy"`
	CheckedAt string `json:"checkedAt"`
	Error     string `json:"error"`
}
type Service struct {
	mu         sync.Mutex
	op         sync.Mutex
	status     Status
	client     *http.Client
	configPath string
	restart    func()
	executable func() (string, error)
}

func version(v string) string { return "v" + strings.TrimPrefix(v, "v") }

var stableVersion = regexp.MustCompile(`^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)

func valid(v string) bool { return stableVersion.MatchString(v) }
func newer(candidate, current string) bool {
	if !valid(candidate) || !valid(current) {
		return false
	}
	a, b := strings.Split(strings.TrimPrefix(candidate, "v"), "."), strings.Split(strings.TrimPrefix(current, "v"), ".")
	for i := range a {
		x, e := strconv.ParseUint(a[i], 10, 64)
		y, f := strconv.ParseUint(b[i], 10, 64)
		if e != nil || f != nil {
			return false
		}
		if x != y {
			return x > y
		}
	}
	return false
}
func New(current string, restart func()) *Service {
	home, _ := os.UserHomeDir()
	s := &Service{status: Status{Current: current}, client: &http.Client{Timeout: 90 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 || req.URL.Scheme != "https" || req.URL.Host != "nextx.uk" {
			return fmt.Errorf("拒绝发布源跨站或不安全重定向")
		}
		return nil
	}}, configPath: filepath.Join(home, ".jira-workbench-updates.json"), restart: restart, executable: os.Executable}
	s.status.Supported = (runtime.GOOS == "linux" || runtime.GOOS == "darwin") && os.Getenv("JIRA_SELF_UPDATE") == "1" && os.Getenv("JIRA_CONTAINER") != "1"
	if !s.status.Supported {
		s.status.Reason = "应用内安装仅支持启用 JIRA_SELF_UPDATE=1 的 macOS/Linux 独立程序；Docker 请重新构建并部署容器，Windows 请手动下载替换。"
	}
	var cfg struct {
		Auto bool `json:"auto"`
	}
	if data, err := os.ReadFile(s.configPath); err == nil {
		_ = json.Unmarshal(data, &cfg)
	}
	s.status.Auto = cfg.Auto && s.status.Supported
	return s
}
func (s *Service) Status() Status { s.mu.Lock(); defer s.mu.Unlock(); return s.status }
func (s *Service) SetAuto(enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if enabled && !s.status.Supported {
		return fmt.Errorf("%s", s.status.Reason)
	}
	data, _ := json.Marshal(map[string]bool{"auto": enabled})
	f, err := os.CreateTemp(filepath.Dir(s.configPath), ".updates-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(f.Name(), s.configPath); err != nil {
		return err
	}
	s.status.Auto = enabled
	return nil
}
func (s *Service) fetch(ctx context.Context, url string, limit int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if url == source {
		req.Header.Set("Cache-Control", "no-cache")
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("发布源返回 HTTP %d", resp.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > limit {
		return nil, fmt.Errorf("发布文件超过大小限制")
	}
	return b, nil
}
func (s *Service) check(ctx context.Context) (Release, error) {
	var release Release
	b, err := s.fetch(ctx, source, 1<<20)
	if err == nil {
		err = json.Unmarshal(b, &release)
	}
	if err == nil && !valid(release.Version) {
		err = fmt.Errorf("发布源版本号无效")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status.CheckedAt = time.Now().Format(time.RFC3339)
	s.status.Error = ""
	if err != nil {
		s.status.Error = err.Error()
		s.status.Available = false
		return release, err
	}
	s.status.Latest = release.Version
	s.status.Available = newer(release.Version, s.status.Current)
	return release, nil
}
func (s *Service) Check(ctx context.Context) error {
	s.op.Lock()
	defer s.op.Unlock()
	_, err := s.check(ctx)
	return err
}

// CheckAndNotify bounds metadata checks without reducing the download timeout.
func (s *Service) CheckAndNotify(ctx context.Context, out io.Writer) {
	if !valid(s.Status().Current) {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := s.Check(ctx); err != nil {
		fmt.Fprintf(out, "检查更新失败（不影响服务运行）：%v\n", err)
		return
	}
	st := s.Status()
	if st.Available {
		fmt.Fprintf(out, "发现新版本 %s（当前 %s），请前往工作台设置 → 版本与更新，或访问 https://nextx.uk/jira-work/ 更新。\n", st.Latest, st.Current)
	}
}

func (s *Service) Start(ctx context.Context) {
	go func() {
		tick := time.NewTicker(6 * time.Hour)
		defer tick.Stop()
		first := true
		for {
			if !first || s.Status().CheckedAt == "" {
				s.CheckAndNotify(ctx, os.Stdout)
			}
			first = false
			if s.Status().Auto && s.Status().Available {
				_ = s.Install(ctx)
			}
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
			}
		}
	}()
}
func (s *Service) Install(ctx context.Context) (err error) {
	if !s.op.TryLock() {
		return fmt.Errorf("正在检查或更新，请稍后重试")
	}
	defer s.op.Unlock()
	st := s.Status()
	if !st.Supported {
		return fmt.Errorf("%s", st.Reason)
	}
	if st.Busy {
		return fmt.Errorf("正在重启")
	}
	s.mu.Lock()
	s.status.Busy = true
	s.status.Error = ""
	s.mu.Unlock()
	defer func() {
		if err != nil {
			s.mu.Lock()
			s.status.Busy = false
			s.status.Error = err.Error()
			s.mu.Unlock()
		}
	}()
	release, err := s.check(ctx)
	if err != nil {
		return err
	}
	if !newer(release.Version, st.Current) {
		return fmt.Errorf("没有可安装的新版本")
	}
	name := fmt.Sprintf("jira-%s-%s.tar.gz", runtime.GOOS, runtime.GOARCH)
	checksum := release.Checksums[name]
	if decoded, e := hex.DecodeString(checksum); e != nil || len(decoded) != 32 {
		return fmt.Errorf("发布包缺少有效 SHA-256 校验值")
	}
	// Only the configured publisher is trusted; metadata cannot redirect downloads.
	url := "https://nextx.uk/jira-work/releases/" + version(release.Version) + "/" + name
	data, err := s.fetch(ctx, url, 128<<20)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(data)
	if !strings.EqualFold(hex.EncodeToString(sum[:]), checksum) {
		return fmt.Errorf("下载校验失败，保留当前版本")
	}
	exe, err := s.executable()
	if err != nil {
		return err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return err
	}
	staged, err := os.CreateTemp(filepath.Dir(exe), ".jira-update-*")
	if err != nil {
		return fmt.Errorf("程序目录不可写: %w", err)
	}
	defer os.Remove(staged.Name())
	defer staged.Close()
	if err = extract(data, staged); err != nil {
		return err
	}
	if err = staged.Chmod(0755); err != nil {
		return err
	}
	if err = staged.Sync(); err != nil {
		return err
	}
	if err = staged.Close(); err != nil {
		return err
	}
	probeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	output, err := exec.CommandContext(probeCtx, staged.Name(), "--version").Output()
	if err != nil || strings.TrimSpace(string(output)) != "Jira Workbench "+version(release.Version) {
		return fmt.Errorf("新程序版本自检失败，保留当前版本")
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	backup := exe + ".previous"
	// Keep the old executable available if starting the new one fails.
	if err = os.Remove(backup); err != nil && !os.IsNotExist(err) {
		return err
	}
	if err = os.Link(exe, backup); err != nil {
		return err
	}
	if err = os.Rename(staged.Name(), exe); err != nil {
		return err
	}
	s.restart()
	return nil
}
func extract(data []byte, w io.Writer) error {
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	found := false
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if h.Name != "jira" || h.Typeflag != tar.TypeReg || found || h.Size <= 0 || h.Size > 256<<20 {
			return fmt.Errorf("发布包内容无效")
		}
		if _, err = io.CopyN(w, tr, h.Size); err != nil {
			return err
		}
		found = true
	}
	if !found {
		return fmt.Errorf("发布包没有 jira 程序")
	}
	return nil
}
