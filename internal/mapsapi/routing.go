package mapsapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (s *API) ConfigureRouting(base string) error {
	if base == "" {
		return nil
	}
	u, err := url.Parse(base)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("invalid ROUTING_BASE_URL")
	}
	s.routingURL = strings.TrimRight(base, "/")
	s.routingSlots = make(chan struct{}, 4)
	return nil
}
func (s *API) ConfigureTiles(base string) error {
	if base == "" {
		return nil
	}
	u, err := url.Parse(base)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("invalid TILE_BASE_URL")
	}
	s.tileURL = strings.TrimRight(base, "/")
	return nil
}
func (s *API) SetRoutingCoverage(coverage string) error {
	if coverage == "" {
		coverage = "unspecified"
	}
	if coverage != "world" && coverage != "americas" && coverage != "latin_america" && coverage != "unspecified" {
		return errors.New("ROUTING_COVERAGE must be world, americas or latin_america")
	}
	s.routingCoverage = coverage
	return nil
}

type routeInput struct {
	Locations []Point `json:"locations"`
	Profile   string  `json:"profile"`
	Sources   []Point `json:"sources,omitempty"`
	Targets   []Point `json:"targets,omitempty"`
}

func profile(name string) (string, bool) {
	switch name {
	case "", "driving":
		return "auto", true
	case "walking":
		return "pedestrian", true
	case "cycling":
		return "bicycle", true
	}
	return "", false
}
func routingPoints(points []Point) []map[string]any {
	out := []map[string]any{}
	for _, p := range points {
		out = append(out, map[string]any{"lat": p.Latitude, "lon": p.Longitude, "radius": 200, "search_cutoff": 1000, "type": "break"})
	}
	return out
}
func (s *API) router(ctx context.Context, path string, input any) ([]byte, int, error) {
	if s.routingURL == "" {
		return nil, 503, errors.New("motor no configurado")
	}
	select {
	case s.routingSlots <- struct{}{}:
		defer func() { <-s.routingSlots }()
	default:
		return nil, 503, errors.New("motor ocupado")
	}
	body, _ := json.Marshal(input)
	req, err := http.NewRequestWithContext(ctx, "POST", s.routingURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, 502, err
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := s.upstream.Do(req)
	if err != nil {
		return nil, 502, err
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, (4<<20)+1))
	if err != nil || len(raw) > 4<<20 {
		return nil, 502, errors.New("respuesta inválida")
	}
	if response.StatusCode != 200 {
		status := 422
		if response.StatusCode >= 500 {
			status = 502
		}
		if response.StatusCode == 429 || response.StatusCode == 503 {
			status = 503
		}
		if response.StatusCode == 404 {
			status = 502
		}
		return nil, status, fmt.Errorf("routing status %d", response.StatusCode)
	}
	return raw, 200, nil
}
func routingError(w http.ResponseWriter, status int) {
	code := "routing_unavailable"
	message := "No se pudo consultar el motor de rutas. Reintenta."
	if status == 422 {
		code = "route_not_found"
		message = "No se encontró un trayecto por calles para esos puntos y perfil dentro de la cobertura disponible."
	}
	fail(w, status, code, message)
}
func decodeShape(encoded string) ([][]float64, error) {
	coords := [][]float64{}
	lat, lng := int64(0), int64(0)
	index := 0
	value := func() (int64, error) {
		var result int64
		shift := uint(0)
		for {
			if index >= len(encoded) || shift > 35 {
				return 0, errors.New("invalid polyline")
			}
			c := int(encoded[index]) - 63
			index++
			if c < 0 || c > 63 {
				return 0, errors.New("invalid polyline")
			}
			result |= int64(c&31) << shift
			shift += 5
			if c < 32 {
				break
			}
		}
		if result&1 != 0 {
			return ^(result >> 1), nil
		}
		return result >> 1, nil
	}
	for index < len(encoded) {
		a, e := value()
		if e != nil {
			return nil, e
		}
		b, e := value()
		if e != nil {
			return nil, e
		}
		lat += a
		lng += b
		x, y := float64(lng)/1e6, float64(lat)/1e6
		if !validCoordinates(y, x) || len(coords) >= 100000 {
			return nil, errors.New("invalid shape")
		}
		coords = append(coords, []float64{x, y})
	}
	if len(coords) < 2 {
		return nil, errors.New("empty shape")
	}
	return coords, nil
}
func (s *API) routes(w http.ResponseWriter, r *http.Request) {
	var in routeInput
	if !decodeInput(w, r, &in, 16<<10) {
		return
	}
	costing, ok := profile(in.Profile)
	if !ok || len(in.Locations) < 2 || len(in.Locations) > 10 || len(in.Sources) > 0 || len(in.Targets) > 0 {
		fail(w, 400, "invalid_route", "Usa de 2 a 10 locations y perfil driving, walking o cycling.")
		return
	}
	for _, p := range in.Locations {
		if !p.Valid() {
			fail(w, 400, "invalid_coordinates", "Coordenadas inválidas.")
			return
		}
	}
	if in.Profile == "" {
		in.Profile = "driving"
	}
	start := time.Now()
	key, _ := json.Marshal(in)

	body, cached, err := s.cache.get(r.Context(), "route:"+string(key), 15*time.Minute, func(ctx context.Context) ([]byte, error) {
		raw, status, err := s.router(ctx, "/route", map[string]any{"locations": routingPoints(in.Locations), "costing": costing, "directions_options": map[string]any{"units": "kilometers", "language": "es-ES"}, "shape_format": "polyline6"})

		if err != nil {
			return nil, routingFailure{status}
		}
		var out struct {
			Trip struct {
				Summary struct {
					Length float64 `json:"length"`
					Time   float64 `json:"time"`
				} `json:"summary"`
				Locations []json.RawMessage `json:"locations"`
				Legs      []struct {
					Shape     string `json:"shape"`
					Maneuvers []struct {
						Instruction string   `json:"instruction"`
						Length      float64  `json:"length"`
						Time        float64  `json:"time"`
						Type        int      `json:"type"`
						StreetNames []string `json:"street_names"`
						Begin       int      `json:"begin_shape_index"`
						End         int      `json:"end_shape_index"`
					} `json:"maneuvers"`
				} `json:"legs"`
			} `json:"trip"`
		}
		if json.Unmarshal(raw, &out) != nil || len(out.Trip.Legs) == 0 {
			return nil, errors.New("invalid route")
		}
		coords := [][]float64{}
		steps := []map[string]any{}
		snapped := []map[string]float64{}
		for legIndex, leg := range out.Trip.Legs {
			points, e := decodeShape(leg.Shape)
			if e != nil {
				return nil, e
			}
			snapped = append(snapped, map[string]float64{"latitude": points[0][1], "longitude": points[0][0]})
			if legIndex == len(out.Trip.Legs)-1 {
				last := points[len(points)-1]
				snapped = append(snapped, map[string]float64{"latitude": last[1], "longitude": last[0]})
			}
			offset := len(coords)
			if len(coords) > 0 && coords[len(coords)-1][0] == points[0][0] && coords[len(coords)-1][1] == points[0][1] {
				points = points[1:]
				offset--
			}
			coords = append(coords, points...)
			for _, step := range leg.Maneuvers {
				steps = append(steps, map[string]any{"instruction": step.Instruction, "distanceMeters": math.Round(step.Length * 1000), "durationSeconds": step.Time, "type": step.Type, "streetNames": step.StreetNames, "beginShapeIndex": step.Begin + offset, "endShapeIndex": step.End + offset, "legIndex": legIndex})
			}
		}
		return json.Marshal(map[string]any{"profile": in.Profile, "locations": in.Locations, "snappedLocations": snapped, "distanceMeters": math.Round(out.Trip.Summary.Length * 1000), "durationSeconds": out.Trip.Summary.Time, "geometry": map[string]any{"type": "LineString", "coordinates": coords}, "steps": steps, "traffic": "not_included", "coverage": s.routingCoverage, "attribution": attribution})
	})
	if err != nil {
		status := 502
		var failure routingFailure
		if errors.As(err, &failure) {
			status = failure.status
		}
		routingError(w, status)
		return
	}
	respond(w, body, cached, start)
}
func (s *API) matrix(w http.ResponseWriter, r *http.Request) {
	var in routeInput
	if !decodeInput(w, r, &in, 16<<10) {
		return
	}
	costing, ok := profile(in.Profile)
	if !ok || len(in.Sources) < 1 || len(in.Sources) > 10 || len(in.Targets) < 1 || len(in.Targets) > 10 || len(in.Locations) > 0 {
		fail(w, 400, "invalid_matrix", "Usa de 1 a 10 sources y targets, con perfil driving, walking o cycling.")
		return
	}
	for _, points := range [][]Point{in.Sources, in.Targets} {
		for _, p := range points {
			if !p.Valid() {
				fail(w, 400, "invalid_coordinates", "Coordenadas inválidas.")
				return
			}
		}
	}
	raw, status, err := s.router(r.Context(), "/sources_to_targets", map[string]any{"sources": routingPoints(in.Sources), "targets": routingPoints(in.Targets), "costing": costing, "units": "kilometers"})
	if err != nil {
		routingError(w, status)
		return
	}
	var out struct {
		Cells [][]struct {
			Time     *float64 `json:"time"`
			Distance *float64 `json:"distance"`
		} `json:"sources_to_targets"`
	}
	if json.Unmarshal(raw, &out) != nil || len(out.Cells) != len(in.Sources) {
		fail(w, 502, "routing_unavailable", "Respuesta de matriz inválida.")
		return
	}
	durations := [][]*float64{}
	distances := [][]*float64{}
	for _, row := range out.Cells {
		if len(row) != len(in.Targets) {
			fail(w, 502, "routing_unavailable", "Respuesta de matriz inválida.")
			return
		}
		ds := []*float64{}
		ms := []*float64{}
		for _, cell := range row {
			ds = append(ds, cell.Time)
			if cell.Distance != nil {
				m := math.Round(*cell.Distance * 1000)
				ms = append(ms, &m)
			} else {
				ms = append(ms, nil)
			}
		}
		durations = append(durations, ds)
		distances = append(distances, ms)
	}
	writeJSON(w, 200, map[string]any{"durationSeconds": durations, "distanceMeters": distances, "sources": in.Sources, "targets": in.Targets, "traffic": "not_included", "coverage": s.routingCoverage, "attribution": attribution})
}

type routingFailure struct{ status int }

func (e routingFailure) Error() string { return fmt.Sprintf("routing failed: %d", e.status) }
