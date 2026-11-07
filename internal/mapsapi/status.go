package mapsapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

func (s *API) status(w http.ResponseWriter, r *http.Request) {
	body, _, err := s.cache.get(r.Context(), "service-status", time.Minute, func(ctx context.Context) ([]byte, error) {
		type result struct{ name, status string }
		results := make(chan result, 3)
		components := map[string]string{}
		pending := 0
		for name, endpoint := range map[string]string{"search": s.provider + "/status", "routing": optionalEndpoint(s.routingURL, "/status"), "cartography": optionalEndpoint(s.tileURL, "/world/0/0/0.mvt")} {
			if endpoint == "" {
				components[name] = "not_configured"
				continue
			}
			pending++
			go func(name, endpoint string) {
				state := "operational"
				req, _ := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
				resp, e := s.upstream.Do(req)
				if e != nil {
					state = "unavailable"
				} else {
					resp.Body.Close()
					if resp.StatusCode != 200 {
						state = "unavailable"
					}
				}
				results <- result{name, state}
			}(name, endpoint)
		}
		state := "operational"
		for i := 0; i < pending; i++ {
			v := <-results
			components[v.name] = v.status
			if v.status != "operational" {
				state = "degraded"
			}
		}
		value := map[string]any{"status": state, "checkedAt": time.Now().UTC(), "components": components, "coverage": map[string]string{"search": "world", "routing": s.routingCoverage}, "limits": map[string]int{"batchItems": 10, "routeLocations": 10, "matrixSources": 10, "matrixTargets": 10, "coverageZones": 20}, "billing": "one_admitted_http_request", "traffic": "not_included"}
		if s.streets != nil {
			value["streetIndex"] = map[string]any{"country": "PE", "records": len(s.streets.records), "coordinateType": "street_reference", "downloadURL": "/downloads/peru-streets.json.gz"}
		}
		return json.Marshal(value)
	})
	if err != nil {
		fail(w, 503, "status_unavailable", "No se pudo comprobar el estado.")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=30")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}
func optionalEndpoint(base, path string) string {
	if base == "" {
		return ""
	}
	return base + path
}
