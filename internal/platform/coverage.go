package platform

import (
	"encoding/json"
	"github.com/lucast1574/nexode-maps-api/internal/mapsapi"
	"net/http"
)

func (p *Platform) zones(w http.ResponseWriter, r *http.Request) {
	rows, err := p.db.QueryContext(r.Context(), "SELECT id,payload FROM coverage_zones WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", current(r).ID)
	if err != nil {
		problem(w, 503, "storage", "No se pudieron cargar las zonas.")
		return
	}
	defer rows.Close()
	zones := []mapsapi.Zone{}
	for rows.Next() {
		var id string
		var raw []byte
		var z mapsapi.Zone
		if rows.Scan(&id, &raw) != nil || json.Unmarshal(raw, &z) != nil {
			problem(w, 503, "storage", "No se pudieron cargar las zonas.")
			return
		}
		z.ID = id
		zones = append(zones, z)
	}
	if rows.Err() != nil {
		problem(w, 503, "storage", "No se pudieron cargar las zonas.")
		return
	}
	reply(w, 200, map[string]any{"zones": zones})
}
func (p *Platform) saveZone(w http.ResponseWriter, r *http.Request) {
	var z mapsapi.Zone
	if decode(w, r, &z) != nil {
		problem(w, 400, "invalid_zone", "Envía una zona válida.")
		return
	}
	if err := z.Validate(); err != nil {
		problem(w, 400, "invalid_zone", err.Error())
		return
	}
	z.ID = token("zone_")
	raw, _ := json.Marshal(z)
	tx, err := p.db.BeginTx(r.Context(), nil)
	if err != nil {
		problem(w, 503, "storage", "No se pudo guardar la zona.")
		return
	}
	defer tx.Rollback()
	var uid string
	if tx.QueryRowContext(r.Context(), "SELECT id FROM users WHERE id=$1 FOR UPDATE", current(r).ID).Scan(&uid) != nil {
		problem(w, 503, "storage", "Intenta más tarde.")
		return
	}
	var count int
	if tx.QueryRowContext(r.Context(), "SELECT count(*) FROM coverage_zones WHERE user_id=$1", uid).Scan(&count) != nil {
		problem(w, 503, "storage", "Intenta más tarde.")
		return
	}
	if count >= 50 {
		problem(w, 400, "zone_limit", "Puedes guardar hasta 50 zonas por cuenta.")
		return
	}
	if _, err = tx.ExecContext(r.Context(), "INSERT INTO coverage_zones(id,user_id,name,payload) VALUES($1,$2,$3,$4)", z.ID, uid, z.Name, string(raw)); err != nil {
		problem(w, 503, "storage", "No se pudo guardar la zona.")
		return
	}
	if tx.Commit() != nil {
		problem(w, 503, "storage", "No se pudo guardar la zona.")
		return
	}
	reply(w, 201, z)
}
func (p *Platform) deleteZone(w http.ResponseWriter, r *http.Request) {
	result, err := p.db.ExecContext(r.Context(), "DELETE FROM coverage_zones WHERE id=$1 AND user_id=$2", r.PathValue("id"), current(r).ID)
	if err != nil {
		problem(w, 503, "storage", "No se pudo eliminar la zona.")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		problem(w, 404, "not_found", "Zona no encontrada.")
		return
	}
	reply(w, 200, map[string]bool{"ok": true})
}
func (p *Platform) checkCoverage(w http.ResponseWriter, r *http.Request, a allowance) {
	var in struct {
		Point   mapsapi.Point `json:"point"`
		ZoneIDs []string      `json:"zoneIds"`
	}
	if decode(w, r, &in) != nil || !in.Point.Valid() || len(in.ZoneIDs) < 1 || len(in.ZoneIDs) > 20 {
		problem(w, 400, "invalid_coverage", "Indica un punto y de 1 a 20 identificadores de zonas.")
		return
	}
	zones := []mapsapi.Zone{}
	seen := map[string]bool{}
	for _, id := range in.ZoneIDs {
		if seen[id] {
			continue
		}
		seen[id] = true
		var raw []byte
		var z mapsapi.Zone
		err := p.db.QueryRowContext(r.Context(), "SELECT payload FROM coverage_zones WHERE id=$1 AND user_id=$2", id, a.UserID).Scan(&raw)
		if err != nil {
			problem(w, 404, "not_found", "Zona no encontrada en tu cuenta.")
			return
		}
		if json.Unmarshal(raw, &z) != nil {
			problem(w, 503, "storage", "No se pudo cargar la zona.")
			return
		}
		z.ID = id
		zones = append(zones, z)
	}
	reply(w, 200, mapsapi.Coverage(in.Point, zones))
}
