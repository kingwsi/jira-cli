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
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

type transport func(*http.Request) (*http.Response, error)

func (f transport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestStartupUpdateNotice(t *testing.T) {
	for _, tc := range []struct{ current, latest, want string }{
		{"v1.0.3", "v1.0.4", "发现新版本 v1.0.4"},
		{"v1.0.3", "v1.0.3", "暂无可用更新"},
		{"v1.0.3", "v1.0.2", "暂无可用更新"},
		{"v1.0.3", "failure", "检查更新失败（不影响服务运行）"},
		{"dev", "v1.0.4", "跳过自动检查更新"},
	} {
		t.Run(tc.current+"/"+tc.latest, func(t *testing.T) {
			s := New(tc.current, func() { t.Fatal("check must not restart") })
			s.client.Transport = transport(func(r *http.Request) (*http.Response, error) {
				if tc.current == "dev" {
					t.Fatal("dev builds must skip update check")
				}
				deadline, ok := r.Context().Deadline()
				if !ok || time.Until(deadline) > 3*time.Second {
					t.Fatal("missing bounded timeout")
				}
				if r.Header.Get("Cache-Control") != "no-cache" {
					t.Fatal("metadata must revalidate cache")
				}
				if tc.latest == "failure" {
					return nil, fmt.Errorf("offline")
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"version":"` + tc.latest + `","summary":"改善顶部更新提醒"}`)), Header: make(http.Header)}, nil
			})
			var out bytes.Buffer
			s.CheckAndNotify(context.Background(), &out)
			if tc.want == "" && out.Len() != 0 || !strings.Contains(out.String(), tc.want) {
				t.Fatalf("unexpected notice: %s", out.String())
			}
			if s.Status().Available && (!strings.Contains(out.String(), "更新内容：改善顶部更新提醒") || s.Status().Summary != "改善顶部更新提醒") {
				t.Fatalf("missing release summary: %s / %+v", out.String(), s.Status())
			}
		})
	}
}

func TestReleaseSummary(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"", "此版本暂未提供更新说明，请查看下载页。"},
		{"修复问题\n 改善体验\x1b", "修复问题 改善体验"},
		{strings.Repeat("更", 161), strings.Repeat("更", 159) + "…"},
	} {
		if got := releaseSummary(tc.input); got != tc.want {
			t.Fatalf("summary = %q, want %q", got, tc.want)
		}
	}
}

func TestVersionComparison(t *testing.T) {
	for _, tc := range []struct {
		a, b string
		want bool
	}{
		{"v1.10.0", "1.9.0", true}, {"1.2.3", "v1.2.3", false}, {"1.2.2", "1.2.3", false},
		{"v2.0.0", "dev", false}, {"v2.0.0-rc.1", "1.0.0", false}, {"v01.2.3", "1.0.0", false},
	} {
		if got := newer(tc.a, tc.b); got != tc.want {
			t.Errorf("newer(%q,%q)=%v", tc.a, tc.b, got)
		}
	}
}
func archive(name string, kind byte) []byte {
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	tw := tar.NewWriter(gz)
	_ = tw.WriteHeader(&tar.Header{Name: name, Typeflag: kind, Mode: 0755, Size: 3})
	_, _ = tw.Write([]byte("bin"))
	_ = tw.Close()
	_ = gz.Close()
	return b.Bytes()
}
func TestExtractRejectsUnsafeArchive(t *testing.T) {
	for _, tc := range []struct {
		name string
		kind byte
		ok   bool
	}{{"jira", tar.TypeReg, true}, {"../jira", tar.TypeReg, false}, {"jira", tar.TypeSymlink, false}, {"extra", tar.TypeReg, false}} {
		var b bytes.Buffer
		err := extract(archive(tc.name, tc.kind), &b)
		if (err == nil) != tc.ok {
			t.Errorf("extract %q: %v", tc.name, err)
		}
	}
}
func TestCheckAndInstallRefuseBadChecksum(t *testing.T) {
	name := "jira-" + runtime.GOOS + "-" + runtime.GOARCH + ".tar.gz"
	data := archive("jira", tar.TypeReg)
	sum := sha256.Sum256(data)
	for _, checksum := range []string{"", strings.Repeat("0", 64), hex.EncodeToString(sum[:])} {
		s := New("1.0.0", func() { t.Fatal("must not restart") })
		s.status.Supported = true
		// Even a valid checksum must fail before replacement on an unsafe archive.
		payload := data
		if checksum == hex.EncodeToString(sum[:]) {
			payload = archive("../jira", tar.TypeReg)
			sum2 := sha256.Sum256(payload)
			checksum = hex.EncodeToString(sum2[:])
		}
		s.client = &http.Client{Transport: transport(func(r *http.Request) (*http.Response, error) {
			var body []byte
			if strings.HasSuffix(r.URL.Path, "version.json") {
				body, _ = json.Marshal(Release{Version: "v1.1.0", Checksums: map[string]string{name: checksum}})
			} else {
				body = payload
			}
			return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader(body)), Header: make(http.Header)}, nil
		})}
		if err := s.Install(context.Background()); err == nil {
			t.Fatal("unsafe install succeeded")
		}
		if st := s.Status(); st.Busy || st.Error == "" || st.Current != "1.0.0" {
			t.Fatalf("incorrect failure state: %+v", st)
		}
	}
}
func TestAutoConfigPersistence(t *testing.T) {
	s := New("1.0.0", func() {})
	s.configPath = filepath.Join(t.TempDir(), "updates.json")
	s.status.Supported = true
	if err := s.SetAuto(true); err != nil {
		t.Fatal(err)
	}
	if !s.Status().Auto {
		t.Fatal("not enabled")
	}
	s.status.Supported = false
	if err := s.SetAuto(true); err == nil {
		t.Fatal("unsupported enabled")
	}
	if err := s.SetAuto(false); err != nil {
		t.Fatal(err)
	}
}
func TestCheckFailureClearsAvailability(t *testing.T) {
	s := New("1.0.0", func() {})
	s.status.Available = true
	s.client = &http.Client{Transport: transport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 503, Body: io.NopCloser(strings.NewReader("unavailable"))}, nil
	})}
	if err := s.Check(context.Background()); err == nil {
		t.Fatal("expected error")
	}
	if s.Status().Available {
		t.Fatal("stale availability")
	}
}

func TestInstallPreservesPreviousAndRequestsRestart(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix executable fixture")
	}
	dir := t.TempDir()
	exe := filepath.Join(dir, "jira")
	if err := os.WriteFile(exe, []byte("old executable"), 0755); err != nil {
		t.Fatal(err)
	}
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	tw := tar.NewWriter(gz)
	script := []byte("#!/bin/sh\nprintf 'Jira Workbench v1.1.0\\n'\n")
	_ = tw.WriteHeader(&tar.Header{Name: "jira", Typeflag: tar.TypeReg, Mode: 0755, Size: int64(len(script))})
	_, _ = tw.Write(script)
	_ = tw.Close()
	_ = gz.Close()
	sum := sha256.Sum256(b.Bytes())
	name := "jira-" + runtime.GOOS + "-" + runtime.GOARCH + ".tar.gz"
	restarted := false
	s := New("1.0.0", func() { restarted = true })
	s.status.Supported = true
	s.executable = func() (string, error) { return exe, nil }
	s.client = &http.Client{Transport: transport(func(r *http.Request) (*http.Response, error) {
		var body []byte
		if strings.HasSuffix(r.URL.Path, "version.json") {
			body, _ = json.Marshal(Release{Version: "v1.1.0", Checksums: map[string]string{name: hex.EncodeToString(sum[:])}})
		} else {
			if r.URL.Path != "/jira-work/releases/v1.1.0/"+name {
				t.Errorf("unexpected download path: %s", r.URL.Path)
			}
			body = b.Bytes()
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader(body))}, nil
	})}
	if err := s.Install(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !restarted {
		t.Fatal("restart not requested")
	}
	previous, err := os.ReadFile(exe + ".previous")
	if err != nil || string(previous) != "old executable" {
		t.Fatalf("lost backup: %q %v", previous, err)
	}
	current, err := os.ReadFile(exe)
	if err != nil || !bytes.Equal(current, script) {
		t.Fatalf("replacement failed: %v", err)
	}
	if err := s.Install(context.Background()); err == nil {
		t.Fatal("second update during restart accepted")
	}
}
