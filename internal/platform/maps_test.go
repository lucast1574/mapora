package platform

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestMapValidation(t *testing.T) {
	for _, body := range []string{`{}`, `{"center":{"latitude":0}}`, `{"center":{"latitude":90,"longitude":0}}`, `{"center":{"latitude":0,"longitude":181}}`, `{"center":{"latitude":0,"longitude":0},"zoom":20}`, `{"center":{"latitude":0,"longitude":0},"expiresIn":2592001}`} {
		var spec mapSpec
		if err := json.Unmarshal([]byte(body), &spec); err != nil {
			t.Fatal(err)
		}
		if spec.normalize() {
			t.Fatal("accepted invalid map", body)
		}
	}
	var spec mapSpec
	_ = json.Unmarshal([]byte(`{"markers":[{"latitude":0,"longitude":0,"label":"Zero"}]}`), &spec)
	if !spec.normalize() || *spec.Center.Latitude != 0 || *spec.Center.Longitude != 0 || spec.Zoom != 14 || spec.ExpiresIn != 604800 {
		t.Fatal("zero coordinates or defaults lost", spec)
	}
}
func TestMapCapabilitiesQuotaExpiryAndRevocation(t *testing.T) {
	p := databasePlatform(t)
	u, cookie := signupTest(t, p)
	geoKey, _ := keyTest(t, p, cookie)
	body := `{"title":"A place <script>alert(1)</script>","center":{"latitude":0,"longitude":-78,"label":"Zero latitude"},"zoom":12}`
	if w, _ := callHTTP(p, "POST", "/v1/maps", body, nil, geoKey); w.Code != 403 {
		t.Fatal("map scope bypass", w.Code)
	}
	w, k := callHTTP(p, "POST", "/console/keys", `{"name":"Map views","scopes":["maps"]}`, cookie, "")
	if w.Code != 201 {
		t.Fatal(w.Body)
	}
	raw, keyID := text(k["key"]), text(k["id"])
	w, result := callHTTP(p, "POST", "/v1/maps", body, nil, raw)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), raw) || strings.Contains(text(result["embedHtml"]), "<script>") {
		t.Fatal("secret or unescaped title in embed")
	}
	viewToken := strings.TrimPrefix(text(result["url"]), p.config.AppURL+"/map/")
	for i := 0; i < 3; i++ {
		w, data := callHTTP(p, "GET", "/v1/maps/view/"+viewToken, "", nil, "")
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body)
		}
		if data["map"].(map[string]any)["center"].(map[string]any)["latitude"] != float64(0) {
			t.Fatal("point moved")
		}
	}
	var used int
	if err := p.db.QueryRow("SELECT used FROM usage_buckets WHERE user_id=$1", u.ID).Scan(&used); err != nil || used != 1 {
		t.Fatal("view requests charged or creation not counted", used, err)
	}
	if _, err := p.db.Exec("UPDATE map_views SET expires_at=now()-interval '1 second' WHERE token_hash=$1", digest(viewToken)); err != nil {
		t.Fatal(err)
	}
	if w, _ := callHTTP(p, "GET", "/v1/maps/view/"+viewToken, "", nil, ""); w.Code != 404 {
		t.Fatal("expired map available")
	}
	_, result = callHTTP(p, "POST", "/v1/maps", body, nil, raw)
	viewToken = strings.TrimPrefix(text(result["url"]), p.config.AppURL+"/map/")
	_, _ = callHTTP(p, "DELETE", "/console/keys/"+keyID, "", cookie, "")
	if w, _ := callHTTP(p, "GET", "/v1/maps/view/"+viewToken, "", nil, ""); w.Code != 404 {
		t.Fatal("revoked key map available")
	}
	var stored string
	if err := p.db.QueryRowContext(context.Background(), "SELECT token_hash FROM map_views WHERE key_id=$1 LIMIT 1", keyID).Scan(&stored); err != nil || strings.HasPrefix(stored, "mv_") {
		t.Fatal("unhashed capability", err)
	}
}
func TestOnlyMapViewerIsEmbeddable(t *testing.T) {
	p := databasePlatform(t)
	w, _ := callHTTP(p, "GET", "/map/mv_example", "", nil, "")
	if strings.Contains(w.Header().Get("Content-Security-Policy"), "frame-ancestors") || w.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
		t.Fatal("viewer cannot embed or tile referer blocked")
	}
	w, _ = callHTTP(p, "GET", "/app", "", nil, "")
	if !strings.Contains(w.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") {
		t.Fatal("console framing protection removed")
	}
}
