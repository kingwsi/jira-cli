package web

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed dist/*
var distFS embed.FS

// GetFileSystem 返回嵌入的静态资源子文件系统
func GetFileSystem() http.FileSystem {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return http.FS(distFS)
	}
	return http.FS(sub)
}

// SPAServer 包装静态文件并在 404 时回退到 index.html 以支持前端 History 路由
type SPAServer struct {
	fs http.FileSystem
}

func NewSPAServer() *SPAServer {
	return &SPAServer{fs: GetFileSystem()}
}

func (s *SPAServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}

	// 检查文件是否存在
	f, err := s.fs.Open(path)
	if err != nil {
		// 找不到静态文件，回退到 index.html
		indexFile, err := s.fs.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer indexFile.Close()
		stat, _ := indexFile.Stat()
		http.ServeContent(w, r, "index.html", stat.ModTime(), indexFile)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if stat.IsDir() {
		// 目录访问 fallback 到 index.html
		indexFile, err := s.fs.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer indexFile.Close()
		stat, _ := indexFile.Stat()
		http.ServeContent(w, r, "index.html", stat.ModTime(), indexFile)
		return
	}

	http.FileServer(s.fs).ServeHTTP(w, r)
}
