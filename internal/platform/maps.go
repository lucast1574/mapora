package platform

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"html"
	"math"
	"net/http"
	"strings"
	"time"
)

type mapPoint struct {
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	Label     string   `json:"label,omitempty"`
}
type mapSpec struct {
	Title     string     `json:"title"`
	Center    *mapPoint  `json:"center"`
	Markers   []mapPoint `json:"markers"`
	Zoom      int        `json:"zoom"`
	ExpiresIn int64      `json:"expiresIn,omitempty"`
}

func (s *mapSpec) normalize() bool {
	s.Title = strings.TrimSpace(s.Title)
	if len(s.Title) > 160 || len(s.Markers) > 20 {
		return false
	}
	valid := func(p *mapPoint) bool {
		if p == nil || p.Latitude == nil || p.Longitude == nil {
			return false
		}
		lat, lng := *p.Latitude, *p.Longitude
		p.Label = strings.TrimSpace(p.Label)
		return !math.IsNaN(lat) && !math.IsNaN(lng) && !math.IsInf(lat, 0) && !math.IsInf(lng, 0) && lat >= -85.05112878 && lat <= 85.05112878 && lng >= -180 && lng <= 180 && len(p.Label) <= 160
	}
	for i := range s.Markers {
		if !valid(&s.Markers[i]) {
			return false
		}
	}
	if s.Center == nil && len(s.Markers) > 0 {
		p := s.Markers[0]
		s.Center = &p
	}
	if !valid(s.Center) {
		return false
	}
	if len(s.Markers) == 0 {
		s.Markers = []mapPoint{*s.Center}
	}
	if s.Zoom == 0 {
		s.Zoom = 14
	}
	if s.ExpiresIn == 0 {
		s.ExpiresIn = 7 * 24 * 3600
	}
	return s.Zoom >= 1 && s.Zoom <= 19 && s.ExpiresIn >= 60 && s.ExpiresIn <= 30*24*3600
}

// View capabilities only read one map. They never expose the API key or
// authorize geocoding. Revoking the issuing key invalidates its view tokens.
func (p *Platform) createMap(w http.ResponseWriter, r *http.Request, a allowance) {
	var spec mapSpec
	if decode(w, r, &spec) != nil || !spec.normalize() {
		problem(w, 400, "invalid_map", "Indica un centro válido, hasta 20 marcadores, zoom de 1 a 19 y duración de 60 segundos a 30 días. Latitud: ±85.05112878; longitud: ±180.")
		return
	}
	expires := time.Now().UTC().Add(time.Duration(spec.ExpiresIn) * time.Second)
	spec.ExpiresIn = 0
	payload, err := json.Marshal(spec)
	if err != nil {
		problem(w, 400, "invalid_map", "Mapa inválido.")
		return
	}
	raw := token("mv_")
	_, err = p.db.ExecContext(r.Context(), "INSERT INTO map_views(token_hash,key_id,payload,expires_at) VALUES($1,$2,$3,$4)", digest(raw), a.KeyID, string(payload), expires)
	if err != nil {
		problem(w, 503, "storage", "No se pudo guardar el mapa.")
		return
	}
	url := strings.TrimRight(p.config.AppURL, "/") + "/map/" + raw
	embed := fmt.Sprintf(`<iframe src="%s" title="%s" width="100%%" height="420" style="border:0" loading="lazy" allow="fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`, html.EscapeString(url), html.EscapeString(firstMapTitle(spec.Title)))
	reply(w, 201, map[string]any{"url": url, "embedHtml": embed, "expiresAt": expires, "map": spec, "usage": "Crear este mapa consume una petición. Abrir el visor, moverlo o hacer zoom no consume peticiones adicionales de Mapora."})
}
func firstMapTitle(title string) string {
	if title == "" {
		return "Mapa de ubicación"
	}
	return title
}
func (p *Platform) mapView(w http.ResponseWriter, r *http.Request) {
	raw := r.PathValue("token")
	if len(raw) != 67 || !strings.HasPrefix(raw, "mv_") {
		problem(w, 404, "map_unavailable", "Este mapa no está disponible o su enlace caducó.")
		return
	}
	var payload []byte
	var expires time.Time
	err := p.db.QueryRowContext(r.Context(), `SELECT m.payload,m.expires_at FROM map_views m JOIN api_keys k ON k.id=m.key_id JOIN users u ON u.id=k.user_id WHERE m.token_hash=$1 AND m.expires_at>now() AND k.revoked_at IS NULL AND NOT u.disabled`, digest(raw)).Scan(&payload, &expires)
	if err == sql.ErrNoRows {
		problem(w, 404, "map_unavailable", "Este mapa no está disponible o su enlace caducó.")
		return
	}
	if err != nil {
		problem(w, 503, "storage", "No se pudo cargar el mapa. Reintenta.")
		return
	}
	reply(w, 200, map[string]any{"map": json.RawMessage(payload), "expiresAt": expires})
}
