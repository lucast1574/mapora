package mapsapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func ptr(v float64) *float64 { return &v }
func testZone() Zone {
	return Zone{Name: "Centro", Currency: "PEN", FeeCents: 500, Geometry: Polygon{Type: "Polygon", Coordinates: [][][]float64{{{0, 0}, {10, 0}, {10, 10}, {0, 10}, {0, 0}}, {{3, 3}, {4, 3}, {4, 4}, {3, 4}, {3, 3}}}}}
}
func TestCoverageEdgesHolesAndValidation(t *testing.T) {
	z := testZone()
	if e := z.Validate(); e != nil {
		t.Fatal(e)
	}
	for _, tc := range []struct {
		x, y float64
		in   bool
	}{{1, 1, true}, {0, 5, true}, {3.5, 3.5, false}, {3, 3, false}, {20, 20, false}} {
		if z.Contains(Point{ptr(tc.y), ptr(tc.x)}) != tc.in {
			t.Fatal(tc)
		}
	}
	for _, coordinates := range [][][][]float64{{{{0, 0}, {2, 2}, {0, 2}, {2, 0}, {0, 0}}}, {{{0, 0}, {2, 0}, {2, 2}, {0, 2}}}, {{{0, 0}, {1, 0}, {2, 0}, {0, 0}}}} {
		bad := testZone()
		bad.Geometry.Coordinates = coordinates
		if bad.Validate() == nil {
			t.Fatal("invalid zone accepted")
		}
	}
}
func TestDiscoveryAndBatchContracts(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/reverse" {
			if r.URL.Query().Get("osm_tag") != "amenity:pharmacy" || r.URL.Query().Get("radius") != "5.000" {
				t.Error(r.URL)
			}
		}
		if r.URL.Query().Get("q") == "nothing" {
			w.Write([]byte(`{"features":[]}`))
			return
		}
		w.Write([]byte(photonFixture))
	})
	for _, path := range []string{"/v1/autocomplete?q=Lima", "/v1/geocode?city=Lima&countrycodes=PE"} {
		w, v := request(t, api, "GET", path, "")
		if w.Code != 200 || v["count"] != float64(1) {
			t.Fatal(w.Code, v)
		}
		p := v["results"].([]any)[0].(map[string]any)
		q := p["quality"].(map[string]any)
		if q["verified"] != false || q["precision"] != "address" {
			t.Fatal(q)
		}
	}
	w, v := request(t, api, "POST", "/v1/batch", `{"items":[{"id":"first","query":"Lima"},{"id":"second","query":"nothing"}]}`)
	if w.Code != 200 {
		t.Fatal(w.Code, v)
	}
	items := v["results"].([]any)
	if items[0].(map[string]any)["status"] != "ok" || items[1].(map[string]any)["status"] != "not_found" {
		t.Fatal(v)
	}
	w, _ = request(t, api, "GET", "/v1/nearby?lat=-12.12&lng=-77.03&category=pharmacy&radius=5000", "")
	if w.Code != 200 {
		t.Fatal(w.Code)
	}
	for _, path := range []string{"/v1/nearby?lat=0&lng=0&category=unknown", "/v1/nearby?lat=0&lng=0&category=pharmacy&radius=NaN", "/v1/geocode?limit=1"} {
		w, _ := request(t, api, "GET", path, "")
		if w.Code != 400 {
			t.Fatal(path, w.Code)
		}
	}
}
func TestRoutesUseStreetGeometryAndPreserveNoRoute(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var in map[string]any
		json.NewDecoder(r.Body).Decode(&in)
		if in["costing"] == "pedestrian" {
			w.WriteHeader(400)
			w.Write([]byte(`{"error_code":442}`))
			return
		}
		if r.URL.Path == "/sources_to_targets" {
			w.Write([]byte(`{"sources_to_targets":[[{"time":300,"distance":1.5},{"time":null,"distance":null}]]}`))
			return
		}
		w.Write([]byte(`{"trip":{"summary":{"length":1.5,"time":300},"locations":[],"legs":[{"shape":"_izlhA~rlgdF_{geC~ywl@_kwzCn` + "`" + `{nI","maneuvers":[{"instruction":"Continúa por la calle"}]}]}}`))
	}))
	defer upstream.Close()
	api := testAPI(t, func(http.ResponseWriter, *http.Request) {})
	if e := api.ConfigureRouting(upstream.URL); e != nil {
		t.Fatal(e)
	}
	w, v := request(t, api, "POST", "/v1/routes", `{"locations":[{"latitude":38.5,"longitude":-120.2},{"latitude":43.252,"longitude":-126.453}]}`)
	if w.Code != 200 || v["distanceMeters"] != float64(1500) {
		t.Fatal(w.Code, v)
	}
	coords := v["geometry"].(map[string]any)["coordinates"].([]any)
	if len(coords) != 3 {
		t.Fatal(coords)
	}
	for i := 0; i < 2; i++ {
		w, _ := request(t, api, "POST", "/v1/routes", `{"profile":"walking","locations":[{"latitude":0,"longitude":0},{"latitude":1,"longitude":1}]}`)
		if w.Code != 422 {
			t.Fatal(w.Code)
		}
	}
	w, v = request(t, api, "POST", "/v1/matrix", `{"sources":[{"latitude":0,"longitude":0}],"targets":[{"latitude":1,"longitude":1},{"latitude":2,"longitude":2}]}`)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "null") {
		t.Fatal(w.Code, v)
	}
	for _, encoded := range []string{"", "~~~", "?", "\x00??"} {
		if _, err := decodeShape(encoded); err == nil {
			t.Fatal("invalid shape accepted", encoded)
		}
	}
}
