package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist
var assets embed.FS

func Handler() http.Handler {
	root, _ := fs.Sub(assets, "dist")
	files := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clean := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if clean == "." || clean == "" {
			clean = "index.html"
		}
		if _, err := fs.Stat(root, clean); err == nil {
			if strings.HasPrefix(clean, "assets/") {
				w.Header().Set("Cache-Control", "public,max-age=31536000,immutable")
			}
			files.ServeHTTP(w, r)
			return
		}
		if strings.Contains(path.Base(clean), ".") {
			http.NotFound(w, r)
			return
		}
		data, _ := fs.ReadFile(root, "index.html")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(data)
	})
}
