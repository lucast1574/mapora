package mapsapi

import (
	"encoding/json"
	"math"
	"net/http"
)

// Advanced operations use the same private engine and shared provider gate as routes.
func (s *API) isochrones(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Center  Point  `json:"center"`
		Profile string `json:"profile"`
		Minutes []int  `json:"minutes"`
	}
	if !decodeInput(w, r, &in, 8<<10) {
		return
	}
	costing, ok := profile(in.Profile)
	if !ok || !in.Center.Valid() || len(in.Minutes) < 1 || len(in.Minutes) > 4 {
		fail(w, 400, "invalid_isochrone", "Envía center, perfil y de 1 a 4 valores minutes entre 1 y 120.")
		return
	}
	contours := []map[string]int{}
	seen := map[int]bool{}
	for _, m := range in.Minutes {
		if m < 1 || m > 120 || seen[m] {
			fail(w, 400, "invalid_isochrone", "minutes admite valores distintos entre 1 y 120.")
			return
		}
		seen[m] = true
		contours = append(contours, map[string]int{"time": m})
	}
	raw, status, err := s.router(r.Context(), "/isochrone", map[string]any{"locations": routingPoints([]Point{in.Center}), "costing": costing, "contours": contours, "polygons": true, "generalize": 50, "denoise": .5})
	if err != nil {
		routingError(w, status)
		return
	}
	var geo map[string]any
	if json.Unmarshal(raw, &geo) != nil || geo["type"] != "FeatureCollection" {
		fail(w, 502, "routing_unavailable", "Respuesta de isócronas inválida.")
		return
	}
	writeJSON(w, 200, map[string]any{"center": in.Center, "profile": defaultProfile(in.Profile), "minutes": in.Minutes, "geometry": geo, "coverage": s.routingCoverage, "traffic": "not_included", "attribution": attribution})
}
func defaultProfile(p string) string {
	if p == "" {
		return "driving"
	}
	return p
}
func (s *API) match(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Locations []Point `json:"locations"`
		Profile   string  `json:"profile"`
	}
	if !decodeInput(w, r, &in, 256<<10) {
		return
	}
	costing, ok := profile(in.Profile)
	if !ok || len(in.Locations) < 2 || len(in.Locations) > 2000 {
		fail(w, 400, "invalid_trace", "Usa de 2 a 2000 puntos y perfil driving, walking o cycling.")
		return
	}
	shape := []map[string]float64{}
	distance := 0.0
	for i, p := range in.Locations {
		if !p.Valid() {
			fail(w, 400, "invalid_coordinates", "Coordenadas inválidas.")
			return
		}
		shape = append(shape, map[string]float64{"lat": *p.Latitude, "lon": *p.Longitude})
		if i > 0 {
			a := in.Locations[i-1]
			distance += distanceMeters(*a.Latitude, *a.Longitude, *p.Latitude, *p.Longitude)
		}
	}
	if distance > 200000 {
		fail(w, 400, "trace_limit", "El recorrido GPS admite hasta 200 km de longitud acumulada.")
		return
	}
	raw, status, err := s.router(r.Context(), "/trace_attributes", map[string]any{"shape": shape, "costing": costing, "shape_match": "map_snap", "shape_format": "polyline6", "filters": map[string]any{"action": "include", "attributes": []string{"shape", "confidence_score", "matched.point", "matched.type", "matched.edge_index", "edge.names", "edge.length", "edge.speed", "edge.road_class", "edge.way_id"}}})
	if err != nil {
		routingError(w, status)
		return
	}
	var out struct {
		Shape      string            `json:"shape"`
		Confidence *float64          `json:"confidence_score"`
		Edges      []json.RawMessage `json:"edges"`
		Matched    []json.RawMessage `json:"matched_points"`
	}
	if json.Unmarshal(raw, &out) != nil {
		fail(w, 502, "routing_unavailable", "Respuesta de recorrido inválida.")
		return
	}
	coords, err := decodeShape(out.Shape)
	if err != nil {
		fail(w, 502, "routing_unavailable", "Geometría de recorrido inválida.")
		return
	}
	writeJSON(w, 200, map[string]any{"profile": defaultProfile(in.Profile), "locations": in.Locations, "geometry": map[string]any{"type": "LineString", "coordinates": coords}, "polyline": out.Shape, "polylinePrecision": 6, "confidence": out.Confidence, "matchedPoints": out.Matched, "edges": out.Edges, "coverage": s.routingCoverage, "attribution": attribution})
}

// Return a compact encoded geometry without changing the existing GeoJSON contract.
func encodeShape(coords [][]float64, precision int) string {
	out := []byte{}
	lat, lng := int64(0), int64(0)
	factor := math.Pow10(precision)
	appendValue := func(v int64) {
		u := uint64(v << 1)
		if v < 0 {
			u = uint64(^(v << 1))
		}
		for u >= 32 {
			out = append(out, byte((32|(u&31))+63))
			u >>= 5
		}
		out = append(out, byte(u+63))
	}
	for _, p := range coords {
		a, b := int64(math.Round(p[1]*factor)), int64(math.Round(p[0]*factor))
		appendValue(a - lat)
		appendValue(b - lng)
		lat, lng = a, b
	}
	return string(out)
}
