package mapsapi

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

type Business struct {
	ID              string   `json:"id"`
	PlaceName       string   `json:"placeName"`
	Category        string   `json:"category"`
	Latitude        float64  `json:"latitude"`
	Longitude       float64  `json:"longitude"`
	Address         string   `json:"address"`
	City            string   `json:"city,omitempty"`
	CountryCode     string   `json:"countryCode,omitempty"`
	Phone           string   `json:"phone,omitempty"`
	Website         string   `json:"website,omitempty"`
	Email           string   `json:"email,omitempty"`
	OpeningHours    string   `json:"openingHours,omitempty"`
	Wheelchair      string   `json:"wheelchair,omitempty"`
	Cuisine         string   `json:"cuisine,omitempty"`
	Brand           string   `json:"brand,omitempty"`
	Operator        string   `json:"operator,omitempty"`
	CoordinateType  string   `json:"coordinateType"`
	Source          string   `json:"source"`
	SourceUpdatedAt string   `json:"sourceUpdatedAt,omitempty"`
	Attribution     string   `json:"attribution"`
	Verified        bool     `json:"verified"`
	DistanceMeters  *float64 `json:"distanceMeters,omitempty"`
	DurationSeconds *float64 `json:"durationSeconds,omitempty"`
	DetourSeconds   *float64 `json:"detourSeconds,omitempty"`
}
type catalogResult struct {
	Results      []Business     `json:"results"`
	Count        int            `json:"count"`
	HasMore      bool           `json:"hasMore"`
	NextOffset   *int           `json:"nextOffset"`
	Dataset      map[string]any `json:"dataset"`
	Attribution  string         `json:"attribution"`
	DistanceType string         `json:"distanceType,omitempty"`
}

var businessID = regexp.MustCompile(`^osm:[NW]:[1-9][0-9]{0,19}$`)
var categoryPattern = regexp.MustCompile(`^(amenity|shop|tourism|office|leisure|healthcare|craft):[a-z0-9_]{1,80}$`)

func (s *API) ConfigurePlaces(base string) error {
	if base == "" {
		return nil
	}
	u, err := url.Parse(base)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("invalid PLACES_BASE_URL")
	}
	s.placesURL = strings.TrimRight(base, "/")
	return nil
}
func (s *API) catalog(ctx context.Context, path string, q url.Values, dst any) (int, error) {
	if s.placesURL == "" {
		return 503, errors.New("catalog not configured")
	}
	// The catalog has its own bounded query executor; requests still use the API's global admission limit.
	req, err := http.NewRequestWithContext(ctx, "GET", s.placesURL+path+"?"+q.Encode(), nil)
	if err != nil {
		return 502, err
	}
	resp, err := s.upstream.Do(req)
	if err != nil {
		return 503, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		if resp.StatusCode == 404 {
			return 404, errors.New("not found")
		}
		return 503, errors.New("catalog unavailable")
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, (4<<20)+1))
	if err != nil || len(raw) > 4<<20 {
		return 502, errors.New("catalog response too large")
	}
	if err = json.Unmarshal(raw, dst); err != nil {
		return 502, err
	}
	return 200, nil
}
func placeQuery(v url.Values, max int) (url.Values, error) {
	out := url.Values{}
	for _, k := range []string{"q", "category", "lat", "lng", "radius", "bbox", "countrycodes", "city", "offset", "limit"} {
		if x := v.Get(k); x != "" {
			out.Set(k, x)
		}
	}
	if out.Get("q") != "" && !strings.ContainsFunc(out.Get("q"), func(r rune) bool { return unicode.IsLetter(r) || unicode.IsNumber(r) }) {
		return nil, errors.New("q necesita letras o números")
	}
	if len(out.Get("q")) > 200 || len(out.Get("city")) > 200 {
		return nil, errors.New("q y city admiten hasta 200 bytes")
	}
	if alias, ok := categories[out.Get("category")]; ok {
		out.Set("category", alias)
	}
	if c := out.Get("category"); c != "" && !categoryPattern.MatchString(c) {
		return nil, errors.New("category debe ser una categoría OSM, como amenity:pharmacy o shop:bakery")
	}
	if out.Get("lat") != "" || out.Get("lng") != "" {
		lat, lng, e := coordinateQuery(out)
		if e != nil {
			return nil, e
		}
		out.Set("lat", fmt.Sprint(lat))
		out.Set("lng", fmt.Sprint(lng))
		radius := 5000.0
		if x := out.Get("radius"); x != "" {
			radius, e = strconv.ParseFloat(x, 64)
		}
		if e != nil || math.IsNaN(radius) || math.IsInf(radius, 0) || radius < 50 || radius > 50000 {
			return nil, errors.New("radius debe estar entre 50 y 50000 metros")
		}
		out.Set("radius", fmt.Sprint(radius))
	} else if out.Get("radius") != "" {
		return nil, errors.New("radius necesita lat y lng")
	}
	normalized, e := providerQuery(url.Values{"bbox": {out.Get("bbox")}, "countrycodes": {out.Get("countrycodes")}})
	if e != nil {
		return nil, e
	}
	if codes := normalized["countrycode"]; len(codes) > 0 {
		out.Set("countrycodes", strings.Join(codes, ","))
	}
	if box := out.Get("bbox"); box != "" {
		parts := strings.Split(box, ",")
		nums := make([]float64, 4)
		for i, x := range parts {
			nums[i], _ = strconv.ParseFloat(x, 64)
		}
		if !validCoordinates(nums[1], nums[0]) || !validCoordinates(nums[3], nums[2]) {
			return nil, errors.New("bbox fuera de los límites geográficos")
		}
	}
	if out.Get("q") == "" && out.Get("lat") == "" && out.Get("bbox") == "" {
		return nil, errors.New("Indica q, bbox o lat y lng")
	}
	limit := 20
	if x := out.Get("limit"); x != "" {
		n, e := strconv.Atoi(x)
		if e != nil || n < 1 || n > max {
			return nil, fmt.Errorf("limit debe estar entre 1 y %d", max)
		}
		limit = n
	}
	out.Set("limit", strconv.Itoa(limit))
	if x := out.Get("offset"); x != "" {
		n, e := strconv.Atoi(x)
		if e != nil || n < 0 || n > 1000000 {
			return nil, errors.New("offset debe estar entre 0 y 1000000")
		}
	}
	return out, nil
}
func (s *API) places(w http.ResponseWriter, r *http.Request) {
	q, err := placeQuery(r.URL.Query(), 50)
	if err != nil {
		fail(w, 400, "invalid_places", err.Error())
		return
	}
	var out catalogResult
	status, err := s.catalog(r.Context(), "/search", q, &out)
	if err != nil {
		fail(w, status, "places_unavailable", "No se pudo consultar el catálogo de lugares.")
		return
	}
	writeJSON(w, 200, out)
}
func (s *API) placeDetails(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if !businessID.MatchString(id) {
		fail(w, 400, "invalid_place_id", "Usa el id OSM devuelto por la búsqueda de lugares.")
		return
	}
	var out struct {
		Place       Business `json:"place"`
		Attribution string   `json:"attribution"`
	}
	status, err := s.catalog(r.Context(), "/details", url.Values{"id": {id}}, &out)
	if err != nil {
		if status == 404 {
			fail(w, 404, "place_not_found", "Lugar no encontrado en esta versión del catálogo.")
		} else {
			fail(w, status, "places_unavailable", "Catálogo no disponible.")
		}
		return
	}
	writeJSON(w, 200, out)
}
func safeCSV(s string) string {
	v := strings.TrimLeft(s, " \t\r\n")
	if v != "" && strings.ContainsRune("=+-@", rune(v[0])) {
		return "'" + s
	}
	return s
}
func (s *API) exportPlaces(w http.ResponseWriter, r *http.Request) {
	q, err := placeQuery(r.URL.Query(), 1000)
	if err != nil {
		fail(w, 400, "invalid_places", err.Error())
		return
	}
	var out catalogResult
	status, err := s.catalog(r.Context(), "/search", q, &out)
	if err != nil {
		fail(w, status, "places_unavailable", "Catálogo no disponible.")
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="mapora-places.csv"`)
	w.Header().Set("X-Has-More", strconv.FormatBool(out.HasMore))
	if out.NextOffset != nil {
		w.Header().Set("X-Next-Offset", strconv.Itoa(*out.NextOffset))
	}
	w.Header().Set("Access-Control-Expose-Headers", "X-Has-More, X-Next-Offset, X-Quota-Limit, X-Quota-Remaining, X-Quota-Reset")
	writer := csv.NewWriter(w)
	defer writer.Flush()
	_ = writer.Write([]string{"id", "name", "category", "latitude", "longitude", "address", "phone", "website", "opening_hours", "source_updated_at", "attribution"})
	for _, p := range out.Results {
		row := []string{p.ID, p.PlaceName, p.Category, strconv.FormatFloat(p.Latitude, 'f', 7, 64), strconv.FormatFloat(p.Longitude, 'f', 7, 64), p.Address, p.Phone, p.Website, p.OpeningHours, p.SourceUpdatedAt, p.Attribution}
		for i := range row {
			if i != 3 && i != 4 {
				row[i] = safeCSV(row[i])
			}
		}
		_ = writer.Write(row)
	}
}
func (s *API) placesArea(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Geometry Polygon `json:"geometry"`
		Category string  `json:"category"`
		Query    string  `json:"q"`
		Limit    int     `json:"limit"`
		Offset   int     `json:"offset"`
	}
	if !decodeInput(w, r, &in, 32<<10) {
		return
	}
	z := Zone{Name: "Área de consulta", Currency: "USD", Geometry: in.Geometry}
	if err := z.Validate(); err != nil {
		fail(w, 400, "invalid_area", err.Error())
		return
	}
	if in.Limit == 0 {
		in.Limit = 20
	}
	if in.Limit < 1 || in.Limit > 50 || in.Offset < 0 || in.Offset > 1000000 {
		fail(w, 400, "invalid_places", "limit: 1–50; offset: 0–1000000.")
		return
	}
	ring := in.Geometry.Coordinates[0]
	west, south, east, north := ring[0][0], ring[0][1], ring[0][0], ring[0][1]
	for _, p := range ring {
		west = math.Min(west, p[0])
		east = math.Max(east, p[0])
		south = math.Min(south, p[1])
		north = math.Max(north, p[1])
	}
	q, err := placeQuery(url.Values{"bbox": {fmt.Sprintf("%.17g,%.17g,%.17g,%.17g", west, south, east, north)}, "q": {in.Query}, "category": {in.Category}, "limit": {"1000"}, "offset": {strconv.Itoa(in.Offset)}}, 1000)
	if err != nil {
		fail(w, 400, "invalid_places", err.Error())
		return
	}
	var out catalogResult
	status, err := s.catalog(r.Context(), "/search", q, &out)
	if err != nil {
		fail(w, status, "places_unavailable", "Catálogo no disponible.")
		return
	}
	selected := []Business{}
	scanned := 0
	for _, p := range out.Results {
		if len(selected) >= in.Limit {
			break
		}
		scanned++
		lat, lng := p.Latitude, p.Longitude
		if z.Contains(Point{&lat, &lng}) {
			selected = append(selected, p)
		}
	}
	more := scanned < len(out.Results) || out.HasMore
	next := in.Offset + scanned
	writeJSON(w, 200, map[string]any{"results": selected, "count": len(selected), "hasMore": more, "nextOffset": next, "dataset": out.Dataset, "attribution": attribution})
}
func (s *API) travelTimes(ctx context.Context, from, to []Point, costing string) ([][]*float64, error) {
	raw, _, err := s.router(ctx, "/sources_to_targets", map[string]any{"sources": routingPoints(from), "targets": routingPoints(to), "costing": costing, "units": "kilometers"})
	if err != nil {
		return nil, err
	}
	var out struct {
		Cells [][]struct {
			Time *float64 `json:"time"`
		} `json:"sources_to_targets"`
	}
	if json.Unmarshal(raw, &out) != nil || len(out.Cells) != len(from) {
		return nil, errors.New("invalid matrix")
	}
	result := [][]*float64{}
	for _, row := range out.Cells {
		if len(row) != len(to) {
			return nil, errors.New("invalid matrix")
		}
		line := []*float64{}
		for _, c := range row {
			line = append(line, c.Time)
		}
		result = append(result, line)
	}
	return result, nil
}
func pointToRoute(lat, lng float64, route [][]float64) float64 {
	best := math.Inf(1)
	scale := math.Cos(lat * math.Pi / 180)
	kx, ky := 111320*scale, 110574.0
	for i := 1; i < len(route); i++ {
		a, b := route[i-1], route[i]
		ax, ay := (a[0]-lng)*kx, (a[1]-lat)*ky
		bx, by := (b[0]-lng)*kx, (b[1]-lat)*ky
		dx, dy := bx-ax, by-ay
		t := 0.0
		if den := dx*dx + dy*dy; den > 0 {
			t = math.Max(0, math.Min(1, -(ax*dx+ay*dy)/den))
		}
		best = math.Min(best, math.Hypot(ax+t*dx, ay+t*dy))
	}
	return best
}
func (s *API) alongRoute(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Locations        []Point `json:"locations"`
		Profile          string  `json:"profile"`
		Category         string  `json:"category"`
		CorridorMeters   float64 `json:"corridorMeters"`
		MaxDetourSeconds float64 `json:"maxDetourSeconds"`
		Limit            int     `json:"limit"`
	}
	if !decodeInput(w, r, &in, 8<<10) {
		return
	}
	costing, ok := profile(in.Profile)
	if in.CorridorMeters == 0 {
		in.CorridorMeters = 1000
	}
	if in.MaxDetourSeconds == 0 {
		in.MaxDetourSeconds = 600
	}
	if in.Limit == 0 {
		in.Limit = 10
	}
	if !ok || len(in.Locations) != 2 || !in.Locations[0].Valid() || !in.Locations[1].Valid() || in.Limit < 1 || in.Limit > 10 || in.CorridorMeters < 50 || in.CorridorMeters > 5000 || in.MaxDetourSeconds < 1 || in.MaxDetourSeconds > 7200 || in.Category == "" {
		fail(w, 400, "invalid_corridor", "Envía dos locations, category, limit 1–10, corridorMeters 50–5000 y maxDetourSeconds 1–7200.")
		return
	}
	raw, status, err := s.router(r.Context(), "/route", map[string]any{"locations": routingPoints(in.Locations), "costing": costing, "shape_format": "polyline6", "units": "kilometers"})
	if err != nil {
		routingError(w, status)
		return
	}
	var route struct {
		Trip struct {
			Summary struct {
				Time   float64 `json:"time"`
				Length float64 `json:"length"`
			} `json:"summary"`
			Legs []struct {
				Shape string `json:"shape"`
			} `json:"legs"`
		} `json:"trip"`
	}
	if json.Unmarshal(raw, &route) != nil || len(route.Trip.Legs) != 1 {
		fail(w, 502, "routing_unavailable", "Ruta inválida.")
		return
	}
	if route.Trip.Summary.Length > 100 {
		fail(w, 400, "corridor_limit", "Esta búsqueda admite rutas de hasta 100 km.")
		return
	}
	coords, err := decodeShape(route.Trip.Legs[0].Shape)
	if err != nil {
		fail(w, 502, "routing_unavailable", "Geometría inválida.")
		return
	}
	west, south, east, north := coords[0][0], coords[0][1], coords[0][0], coords[0][1]
	for _, p := range coords {
		west = math.Min(west, p[0])
		east = math.Max(east, p[0])
		south = math.Min(south, p[1])
		north = math.Max(north, p[1])
	}
	if east-west > 180 {
		fail(w, 400, "corridor_limit", "El corredor no admite cruce del antimeridiano.")
		return
	}
	dy := in.CorridorMeters / 110574
	dx := in.CorridorMeters / (111320 * math.Max(.01, math.Cos((south+north)/2*math.Pi/180)))
	q, err := placeQuery(url.Values{"bbox": {fmt.Sprintf("%.17g,%.17g,%.17g,%.17g", math.Max(-180, west-dx), math.Max(-90, south-dy), math.Min(180, east+dx), math.Min(90, north+dy))}, "category": {in.Category}, "limit": {"1000"}}, 1000)
	if err != nil {
		fail(w, 400, "invalid_places", err.Error())
		return
	}
	var out catalogResult
	status, err = s.catalog(r.Context(), "/search", q, &out)
	if err != nil {
		fail(w, status, "places_unavailable", "Catálogo no disponible.")
		return
	}
	candidates := []Business{}
	for _, p := range out.Results {
		d := pointToRoute(p.Latitude, p.Longitude, coords)
		if d <= in.CorridorMeters {
			p.DistanceMeters = &d
			candidates = append(candidates, p)
		}
	}
	sort.SliceStable(candidates, func(i, j int) bool { return *candidates[i].DistanceMeters < *candidates[j].DistanceMeters })
	truncated := out.HasMore || len(candidates) > 20
	if len(candidates) > 20 {
		candidates = candidates[:20]
	}
	results := []Business{}
	if len(candidates) > 0 {
		points := []Point{}
		for i := range candidates {
			points = append(points, Point{&candidates[i].Latitude, &candidates[i].Longitude})
		}
		outbound, e := s.travelTimes(r.Context(), in.Locations[:1], points, costing)
		if e != nil {
			routingError(w, 503)
			return
		}
		inbound, e := s.travelTimes(r.Context(), points, in.Locations[1:], costing)
		if e != nil {
			routingError(w, 503)
			return
		}
		for i, p := range candidates {
			if outbound[0][i] == nil || inbound[i][0] == nil {
				continue
			}
			total := *outbound[0][i] + *inbound[i][0]
			detour := math.Max(0, total-route.Trip.Summary.Time)
			if detour <= in.MaxDetourSeconds {
				p.DurationSeconds = &total
				p.DetourSeconds = &detour
				results = append(results, p)
			}
		}
		sort.SliceStable(results, func(i, j int) bool { return *results[i].DetourSeconds < *results[j].DetourSeconds })
		if len(results) > in.Limit {
			results = results[:in.Limit]
		}
	}
	writeJSON(w, 200, map[string]any{"results": results, "count": len(results), "candidateSearchTruncated": truncated, "baselineDurationSeconds": route.Trip.Summary.Time, "geometry": map[string]any{"type": "LineString", "coordinates": coords}, "profile": defaultProfile(in.Profile), "traffic": "not_included", "coverage": s.routingCoverage, "dataset": out.Dataset, "attribution": attribution})
}
