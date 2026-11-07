package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type statusCapture struct {
	header http.Header
	body   bytes.Buffer
	code   int
}

func (c *statusCapture) Header() http.Header { return c.header }
func (c *statusCapture) WriteHeader(code int) {
	if c.code == 0 {
		c.code = code
	}
}
func (c *statusCapture) Write(b []byte) (int, error) {
	if c.code == 0 {
		c.code = 200
	}
	return c.body.Write(b)
}

func (p *Platform) status(w http.ResponseWriter, r *http.Request) {
	capture := &statusCapture{header: http.Header{}}
	p.geo.ServeHTTP(capture, r)
	value := map[string]any{}
	if capture.code != 200 || json.Unmarshal(capture.body.Bytes(), &value) != nil {
		value = map[string]any{"status": "degraded", "checkedAt": time.Now().UTC(), "components": map[string]any{"geography": "unavailable"}}
	}
	components, ok := value["components"].(map[string]any)
	if !ok {
		components = map[string]any{}
		value["components"] = components
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	components["database"] = "operational"
	if p.db.PingContext(ctx) != nil {
		components["database"] = "unavailable"
		value["status"] = "degraded"
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	reply(w, 200, value)
}
