package mapsapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestAdvancedRoutingValidationGeometryAndTrace(t *testing.T) {
	coords := [][]float64{{-77.029, -12.1199}, {-77.0305, -12.1225}, {-77.032, -12.125}}
	encoded := encodeShape(coords, 6)
	if decoded, e := decodeShape(encoded); e != nil || len(decoded) != 3 || decoded[1][0] != coords[1][0] {
		t.Fatal(decoded, e)
	}
	var action string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		action = r.URL.Path
		var in map[string]any
		json.NewDecoder(r.Body).Decode(&in)
		switch r.URL.Path {
		case "/isochrone":
			if in["costing"] != "pedestrian" {
				t.Error(in)
			}
			w.Write([]byte(`{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}}]}`))
		case "/trace_attributes":
			json.NewEncoder(w).Encode(map[string]any{"shape": encoded, "confidence_score": .9, "matched_points": []any{}, "edges": []any{}})
		default:
			json.NewEncoder(w).Encode(map[string]any{"trip": map[string]any{"summary": map[string]any{"length": 1.2, "time": 400}, "locations": []map[string]any{{"original_index": 0}, {"original_index": 2}, {"original_index": 1}, {"original_index": 3}}, "legs": []map[string]any{{"shape": encoded, "maneuvers": []any{}}}}})
		}
	}))
	defer upstream.Close()
	api := testAPI(t, func(http.ResponseWriter, *http.Request) {})
	api.ConfigureRouting(upstream.URL)
	w, v := request(t, api, "POST", "/v1/isochrones", `{"center":{"latitude":-12.12,"longitude":-77.03},"minutes":[5,10],"profile":"walking"}`)
	if w.Code != 200 || v["geometry"] == nil || action != "/isochrone" {
		t.Fatal(w.Code, v)
	}
	points := `[{"latitude":-12.1199,"longitude":-77.029},{"latitude":-12.1225,"longitude":-77.0305}]`
	w, v = request(t, api, "POST", "/v1/match", `{"locations":`+points+`}`)
	if w.Code != 200 || v["polyline"] != encoded || v["confidence"] != .9 {
		t.Fatal(w.Code, v)
	}
	w, v = request(t, api, "POST", "/v1/routes/optimize", `{"locations":`+points+`}`)
	if w.Code != 200 || v["optimized"] != true || action != "/optimized_route" || v["polyline"] != encoded {
		t.Fatal(w.Code, v)
	}
	for _, tc := range []struct{ path, body string }{{"/v1/isochrones", `{"center":{"latitude":0,"longitude":0},"minutes":[5,5]}`}, {"/v1/isochrones", `{"center":{"latitude":0,"longitude":0},"minutes":[121]}`}, {"/v1/match", `{"locations":[{"latitude":0,"longitude":0},{"latitude":20,"longitude":20}]}`}, {"/v1/routes/optimize", `{"locations":[{"latitude":0}]}`}} {
		w, _ := request(t, api, "POST", tc.path, tc.body)
		if w.Code != 400 {
			t.Fatal(tc.path, w.Code)
		}
	}
}
func TestPlaceCatalogValidationExportAndPolygonHoles(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/details" {
			w.WriteHeader(404)
			return
		}
		if r.URL.Query().Get("category") != "amenity:pharmacy" {
			t.Error(r.URL)
		}
		w.Write([]byte(`{"results":[{"id":"osm:N:1","placeName":"=FORMULA()","category":"amenity:pharmacy","latitude":1,"longitude":1,"attribution":"© OpenStreetMap contributors"},{"id":"osm:N:2","placeName":"In hole","latitude":3.5,"longitude":3.5}],"count":2,"hasMore":true,"nextOffset":2,"dataset":{"builtAt":"test"}}`))
	}))
	defer upstream.Close()
	api := testAPI(t, func(http.ResponseWriter, *http.Request) {})
	api.ConfigurePlaces(upstream.URL)
	w, v := request(t, api, "GET", "/v1/places?lat=1&lng=1&category=pharmacy", "")
	if w.Code != 200 || v["count"] != float64(2) {
		t.Fatal(w.Code, v)
	}
	w = httptest.NewRecorder()
	api.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/v1/places/export?lat=1&lng=1&category=pharmacy", nil))
	if w.Code != 200 || !strings.Contains(w.Body.String(), "'=FORMULA()") || w.Header().Get("X-Next-Offset") != "2" {
		t.Fatal(w.Code, w.Body)
	}
	z := testZone()
	b, _ := json.Marshal(map[string]any{"geometry": z.Geometry, "category": "pharmacy"})
	w, v = request(t, api, "POST", "/v1/places/area", string(b))
	if w.Code != 200 || v["count"] != float64(1) {
		t.Fatal(w.Code, v)
	}
	for _, path := range []string{"/v1/places?category=pharmacy", "/v1/places?lat=0&lng=0&limit=51", "/v1/places?lat=0&lng=0&radius=NaN", "/v1/places?lat=0&lng=0&category=arbitrary:value", "/v1/places/details?id=https://example.com"} {
		w, _ := request(t, api, "GET", path, "")
		if w.Code != 400 {
			t.Fatal(path, w.Code)
		}
	}
	w, _ = request(t, api, "GET", "/v1/places/details?id=osm:N:123", "")
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
}
func TestPointToRouteUsesSegments(t *testing.T) {
	route := [][]float64{{0, 0}, {.1, 0}}
	if d := pointToRoute(0, .05, route); d > 1 {
		t.Fatal(d)
	}
	if d := pointToRoute(.01, .05, route); d < 1000 || d > 1200 {
		t.Fatal(d)
	}
}

func TestNearbyTravelTimeRanksReachableCandidates(t *testing.T) {
	photon := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"features":[{"geometry":{"coordinates":[0.001,0]},"properties":{"osm_type":"N","osm_id":1,"name":"Close but slow"}},{"geometry":{"coordinates":[0.002,0]},"properties":{"osm_type":"N","osm_id":2,"name":"Far but fast"}},{"geometry":{"coordinates":[0.003,0]},"properties":{"osm_type":"N","osm_id":3,"name":"Unreachable"}}]}`))
	}))
	defer photon.Close()
	router := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"sources_to_targets":[[{"time":900},{"time":120},{"time":null}]]}`))
	}))
	defer router.Close()
	api, err := NewWithInterval(photon.URL, 10*1000*1000)
	if err != nil {
		t.Fatal(err)
	}
	defer api.providerPace.Stop()
	api.ConfigureRouting(router.URL)
	w, v := request(t, api, "GET", "/v1/nearby?lat=0&lng=0&category=pharmacy&sort=travel_time&profile=walking", "")
	if w.Code != 200 || v["count"] != float64(2) {
		t.Fatal(w.Code, v)
	}
	first := v["results"].([]any)[0].(map[string]any)
	if first["placeName"] != "Far but fast" || first["durationSeconds"] != float64(120) {
		t.Fatal(first)
	}
}
func TestCatalogRejectsOutOfRangeAndEmptyText(t *testing.T) {
	// Invalid numeric bounds must be rejected before querying any upstream.
	for _, q := range []string{"bbox=-181,0,1,1", "bbox=0,-91,1,1", "q=***"} {
		if _, err := placeQuery(queryValues(t, q), 50); err == nil {
			t.Fatal(q)
		}
	}
}

func queryValues(t *testing.T, q string) url.Values {
	t.Helper()
	v, e := url.ParseQuery(q)
	if e != nil {
		t.Fatal(e)
	}
	return v
}
