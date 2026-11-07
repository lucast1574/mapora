package platform

import (
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Tiles are authenticated but do not consume geocoding requests. The raw archive
// and private engine addresses are never exposed through this allowlisted proxy.
func (p *Platform) tiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "X-API-Key, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	if r.Method == "OPTIONS" {
		w.WriteHeader(204)
		return
	}
	select {
	case p.tileSlots <- struct{}{}:
		defer func() { <-p.tileSlots }()
	default:
		w.Header().Set("Retry-After", "1")
		problem(w, 429, "tiles_busy", "La cartografía está ocupada. Reintenta en un momento.")
		return
	}
	authorized := false
	if token := r.PathValue("token"); token != "" {
		if len(token) == 67 && strings.HasPrefix(token, "mv_") {
			err := p.db.QueryRowContext(r.Context(), `SELECT true FROM map_views m JOIN api_keys k ON k.id=m.key_id JOIN users u ON u.id=k.user_id WHERE m.token_hash=$1 AND m.expires_at>now() AND k.revoked_at IS NULL AND NOT u.disabled`, digest(token)).Scan(&authorized)
			if err != nil {
				authorized = false
			}
		}
	} else if strings.HasPrefix(r.URL.Path, "/console/") {
		_, err := p.session(r)
		authorized = err == nil
	} else {
		raw := r.Header.Get("X-API-Key")
		if raw == "" {
			raw = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		}
		var kind string
		var scopes, origins []string
		err := p.db.QueryRowContext(r.Context(), `SELECT k.kind,k.scopes,k.allowed_origins FROM api_keys k JOIN users u ON u.id=k.user_id WHERE k.token_hash=$1 AND k.revoked_at IS NULL AND NOT u.disabled`, digest(raw)).Scan(&kind, &scopes, &origins)
		if err == nil {
			for _, scope := range scopes {
				if scope == "maps" || scope == "search" {
					authorized = true
				}
			}
			if kind == "browser" {
				matched := false
				for _, origin := range origins {
					if origin == r.Header.Get("Origin") {
						matched = true
					}
				}
				authorized = authorized && matched
			}
		}
	}
	if !authorized {
		problem(w, 401, "invalid_key", "La clave, sesión o enlace del mapa no está disponible.")
		return
	}
	base := p.config.TileURL
	u, err := url.Parse(base)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		problem(w, 503, "tiles_unavailable", "La cartografía no está disponible.")
		return
	}
	path := ""
	if font := r.PathValue("font"); font != "" {
		if font != "Noto Sans Regular" && font != "Noto Sans Medium" && font != "Noto Sans Italic" {
			problem(w, 404, "not_found", "Fuente no disponible.")
			return
		}
		span := r.PathValue("range")
		parts := strings.Split(strings.TrimSuffix(span, ".pbf"), "-")
		if len(parts) != 2 {
			problem(w, 404, "not_found", "Rango no válido.")
			return
		}
		a, e1 := strconv.Atoi(parts[0])
		b, e2 := strconv.Atoi(parts[1])
		if e1 != nil || e2 != nil || a < 0 || a%256 != 0 || b != a+255 || b > 65535 {
			problem(w, 404, "not_found", "Rango no válido.")
			return
		}
		path = "/assets/fonts/" + url.PathEscape(font) + "/" + span
	} else if sprite := r.PathValue("sprite"); sprite != "" {
		allowed := false
		for _, name := range []string{"light.json", "light.png", "light@2x.json", "light@2x.png", "dark.json", "dark.png", "dark@2x.json", "dark@2x.png"} {
			if sprite == name {
				allowed = true
			}
		}
		if !allowed {
			problem(w, 404, "not_found", "Sprite no disponible.")
			return
		}
		path = "/assets/sprites/v4/" + sprite
	} else {
		z, e1 := strconv.Atoi(r.PathValue("z"))
		x, e2 := strconv.Atoi(r.PathValue("x"))
		y, e3 := strconv.Atoi(strings.TrimSuffix(r.PathValue("y"), ".mvt"))
		if e1 != nil || e2 != nil || e3 != nil || z < 0 || z > 15 || x < 0 || y < 0 || x >= 1<<z || y >= 1<<z {
			problem(w, 400, "invalid_tile", "Mosaico no válido.")
			return
		}
		path = "/world/" + strconv.Itoa(z) + "/" + strconv.Itoa(x) + "/" + strconv.Itoa(y) + ".mvt"
	}
	req, err := http.NewRequestWithContext(r.Context(), "GET", strings.TrimRight(base, "/")+path, nil)
	if err != nil {
		problem(w, 503, "tiles_unavailable", "Cartografía no disponible.")
		return
	}
	resp, err := p.stripeHTTP.Do(req)
	if err != nil {
		problem(w, 503, "tiles_unavailable", "Cartografía no disponible.")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 204 {
		problem(w, 503, "tiles_unavailable", "No se pudo cargar la cartografía.")
		return
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, (2<<20)+1))
	if err != nil || len(data) > 2<<20 {
		problem(w, 503, "tiles_unavailable", "Respuesta cartográfica inválida.")
		return
	}
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.Header().Set("Cache-Control", "private, max-age=60")
	w.WriteHeader(resp.StatusCode)
	if resp.StatusCode != 204 {
		w.Write(data)
	}
}
func (p *Platform) tileRoutes(mux *http.ServeMux) {
	for _, base := range []string{"/v1/tiles", "/console/tiles", "/v1/maps/view/{token}/tiles"} {
		for _, tail := range []string{"/{z}/{x}/{y}", "/fonts/{font}/{range}", "/sprites/{sprite}"} {
			mux.HandleFunc("GET "+base+tail, p.tiles)
			mux.HandleFunc("OPTIONS "+base+tail, p.tiles)
		}
	}
}
