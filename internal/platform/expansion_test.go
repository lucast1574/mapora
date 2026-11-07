package platform

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBrandedMapsTilesAndRevocation(t *testing.T) {
	p := databasePlatform(t)
	_, cookie := signupTest(t, p)
	engine := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/world/0/0/0.mvt" {
			t.Error(r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/vnd.mapbox-vector-tile")
		w.Write([]byte("fixture-tile"))
	}))
	defer engine.Close()
	p.config.TileURL = engine.URL
	w, key := callHTTP(p, "POST", "/console/keys", `{"name":"Maps","scopes":["maps"]}`, cookie, "")
	if w.Code != 201 {
		t.Fatal(w.Code)
	}
	w, data := callHTTP(p, "POST", "/v1/maps", `{"center":{"latitude":0,"longitude":0},"theme":"dark","accent":"#abcdef","shapes":[{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}]}`, nil, text(key["key"]))
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body)
	}
	token := strings.TrimPrefix(text(data["url"]), p.config.AppURL+"/map/")
	path := "/v1/maps/view/" + token + "/tiles/0/0/0.mvt"
	w, _ = callHTTP(p, "GET", path, "", nil, "")
	if w.Code != 200 || w.Body.String() != "fixture-tile" {
		t.Fatal(w.Code, w.Body)
	}
	callHTTP(p, "DELETE", "/console/keys/"+text(key["id"]), "", cookie, "")
	w, _ = callHTTP(p, "GET", path, "", nil, "")
	if w.Code != 401 {
		t.Fatal("revoked map still loaded new tiles", w.Code)
	}
	w, _ = callHTTP(p, "POST", "/console/keys", `{"name":"Local dev","kind":"browser","scopes":["search"],"allowedOrigins":["http://localhost:4176"]}`, cookie, "")
	if w.Code != 201 {
		t.Fatal("local dev origin rejected", w.Code)
	}
	w, _ = callHTTP(p, "POST", "/console/keys", `{"name":"Invalid","kind":"browser","scopes":["search"],"allowedOrigins":["http://shop.example"]}`, cookie, "")
	if w.Code != 400 {
		t.Fatal("insecure nonlocal origin accepted", w.Code)
	}
}

func TestBrowserKeysOriginAndScopeBeforeQuota(t *testing.T) {
	p := databasePlatform(t)
	u, cookie := signupTest(t, p)
	w, v := callHTTP(p, "POST", "/console/keys", `{"name":"Browser","kind":"browser","scopes":["search","reverse","nearby"],"allowedOrigins":["https://shop.example"]}`, cookie, "")
	if w.Code != 201 {
		t.Fatal(w.Code, v)
	}
	key := text(v["key"])
	for _, origin := range []string{"", "null", "https://evil.example", "https://shop.example.evil"} {
		_, err := p.reserve(context.Background(), key, "search", origin)
		if err == nil || err.Error() != "origin_denied" {
			t.Fatal(origin, err)
		}
	}
	if _, err := p.reserve(context.Background(), key, "search", "https://shop.example"); err != nil {
		t.Fatal(err)
	}
	if _, err := p.reserve(context.Background(), key, "batch", "https://shop.example"); err == nil {
		t.Fatal("browser key reached batch")
	}
	var used int
	if err := p.db.QueryRow("SELECT sum(used) FROM usage_buckets WHERE user_id=$1", u.ID).Scan(&used); err != nil || used != 1 {
		t.Fatal(used, err)
	}
	w, _ = callHTTP(p, "POST", "/console/keys", `{"name":"Invalid","kind":"browser","scopes":["maps"],"allowedOrigins":["https://shop.example"]}`, cookie, "")
	if w.Code != 400 {
		t.Fatal(w.Code)
	}
}

func TestStatusIncludesQuotaDatabaseFailureWithoutDetails(t *testing.T) {
	p := databasePlatform(t)
	p.geo = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reply(w, 200, map[string]any{"status": "operational", "components": map[string]string{"search": "operational"}})
	})
	w, value := callHTTP(p, "GET", "/status", "", nil, "")
	if w.Code != 200 || value["components"].(map[string]any)["database"] != "operational" {
		t.Fatal(w.Code, value)
	}
	p.db.Close()
	w, value = callHTTP(p, "GET", "/status", "", nil, "")
	if w.Code != 200 || value["status"] != "degraded" || value["components"].(map[string]any)["database"] != "unavailable" {
		t.Fatal(w.Code, value)
	}
	if strings.Contains(w.Body.String(), "postgres") || strings.Contains(w.Body.String(), "connection") {
		t.Fatal("database details leaked")
	}
}
func TestSessionStorageOutageIsNotExpiredLogin(t *testing.T) {
	p := databasePlatform(t)
	_, cookie := signupTest(t, p)
	p.db.Close()
	w, value := callHTTP(p, "GET", "/console/session", "", cookie, "")
	if w.Code != 503 || value["code"] != "session_unavailable" {
		t.Fatal(w.Code, value)
	}
}
func TestWrongBatchMethodDoesNotSpendQuota(t *testing.T) {
	p := databasePlatform(t)
	u, cookie := signupTest(t, p)
	w, key := callHTTP(p, "POST", "/console/keys", `{"name":"Batch","scopes":["batch"]}`, cookie, "")
	if w.Code != 201 {
		t.Fatal(w.Code)
	}
	w, _ = callHTTP(p, "GET", "/v1/batch", "", nil, text(key["key"]))
	if w.Code != 405 {
		t.Fatal(w.Code)
	}
	var used int
	if err := p.db.QueryRow("SELECT COALESCE(sum(used),0) FROM usage_buckets WHERE user_id=$1", u.ID).Scan(&used); err != nil || used != 0 {
		t.Fatal(used, err)
	}
}
func TestCoverageOwnershipAndTilesAuthentication(t *testing.T) {
	p := databasePlatform(t)
	_, one := signupTest(t, p)
	_, two := signupTest(t, p)
	body := `{"name":"Centro","geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]},"feeCents":500,"currency":"PEN"}`
	w, v := callHTTP(p, "POST", "/console/zones", body, one, "")
	if w.Code != 201 {
		t.Fatal(w.Code, v)
	}
	id := text(v["id"])
	w, _ = callHTTP(p, "DELETE", "/console/zones/"+id, "", two, "")
	if w.Code != 404 {
		t.Fatal("foreign zone deleted", w.Code)
	}
	w, v = callHTTP(p, "POST", "/console/keys", `{"name":"Coverage","scopes":["coverage"]}`, one, "")
	if w.Code != 201 {
		t.Fatal(w.Code, v)
	}
	key := text(v["key"])
	w, v = callHTTP(p, "POST", "/v1/coverage/check", `{"point":{"latitude":0.5,"longitude":0.5},"zoneIds":["`+id+`"]}`, nil, key)
	if w.Code != 200 || v["covered"] != true {
		t.Fatal(w.Code, v)
	}
	for _, path := range []string{"/v1/tiles/0/0/0.mvt", "/v1/tiles/fonts/Noto%20Sans%20Regular/0-255.pbf", "/v1/maps/view/mv_invalid/tiles/0/0/0.mvt"} {
		r := httptest.NewRequest("GET", path, strings.NewReader(""))
		w := httptest.NewRecorder()
		p.Handler().ServeHTTP(w, r)
		if w.Code != http.StatusUnauthorized {
			t.Fatal(path, w.Code)
		}
	}
}
