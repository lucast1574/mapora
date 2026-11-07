package mapsapi

import (
	"net/http"
	"net/url"
	"runtime"
	"strings"
	"testing"
)

func fixtureStreet(id, name, city string, lat, lng float64) streetRecord {
	return streetRecord{ID: id, Name: name, City: city, District: city, Province: city, State: "La Libertad", Latitude: lat, Longitude: lng, Attribution: "Municipal public data", SourceURL: "https://example.org/streets", SourceDate: "2021-06-04"}
}
func attachTestStreets(t *testing.T, api *API) {
	t.Helper()
	idx, err := newStreetIndex([]streetRecord{
		fixtureStreet("street:trujillo", "Calle Tomás Jefferson", "Trujillo", -8.1258, -79.0242),
		fixtureStreet("street:lima", "Calle Tomás Jefferson", "Lima", -12.1, -77.02),
		fixtureStreet("street:date", "Avenida 28 de Julio", "Trujillo", -8.12, -79.02),
		fixtureStreet("street:number", "Pasaje 101", "Trujillo", -8.12, -79.02),
	})
	if err != nil {
		t.Fatal(err)
	}
	api.streets = idx
}

func TestStreetSearchScopesNumbersAndOriginalPins(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{"features":[]}`)) })
	attachTestStreets(t, api)
	for _, tc := range []struct{ query, city, want, number string }{
		{"TOMAS JEFFERSON 289", "Trujillo", "street:trujillo", "289"},
		{"Ca. Tomás Jefferson N° 289", "Trujillo", "street:trujillo", "289"},
		{"t omás JEFFERSON 289", "Trujillo", "street:trujillo", "289"},
		{"Ca. Tomás Jeff", "Trujillo", "street:trujillo", ""},
		{"Tomás Jefferson 289, Trujillo, Perú", "", "street:trujillo", "289"},
		{"Tomás Jefferson", "Lima", "street:lima", ""},
		{"Av. 28 de Julio 123", "Trujillo", "street:date", "123"},
		{"Pasaje 101", "Trujillo", "street:number", ""},
	} {
		t.Run(tc.query+tc.city, func(t *testing.T) {
			q := url.Values{"q": {tc.query}, "city": {tc.city}, "countrycodes": {"PE"}}
			w, v := request(t, api, "GET", "/v1/search?"+q.Encode(), "")
			if w.Code != 200 || v["count"] != float64(1) {
				t.Fatal(w.Code, v)
			}
			p := v["results"].([]any)[0].(map[string]any)
			if p["id"] != tc.want || p["houseNumber"] != nil || p["quality"].(map[string]any)["precision"] != "street" {
				t.Fatal(p)
			}
			m := p["match"].(map[string]any)
			if m["houseNumberMatched"] != false || m["coordinateType"] != "street_reference" {
				t.Fatal(m)
			}
			if tc.number != "" && m["requestedHouseNumber"] != tc.number {
				t.Fatal(m)
			}
		})
	}
	for _, q := range []url.Values{{"q": {"Tomas Jefferson"}, "countrycodes": {"CL"}}, {"q": {"Tomas Jefferson"}, "city": {"Arequipa"}, "countrycodes": {"PE"}}, {"q": {"Tomas Jefferson"}, "bbox": {"-78,-13,-76,-11"}, "city": {"Trujillo"}}, {"q": {"No Existe Esta Calle"}, "countrycodes": {"PE"}}} {
		w, v := request(t, api, "GET", "/v1/search?"+q.Encode(), "")
		if w.Code != 200 || v["count"] != float64(0) {
			t.Fatal(q, w.Code, v)
		}
	}
}

func TestStreetSearchRejectsUnrelatedFuzzyRoadAndWrongHouse(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"features":[{"geometry":{"coordinates":[-79.01,-8.1]},"properties":{"name":"Pasaje Tomás Méndez","street":"Pasaje Tomás Méndez","city":"Trujillo","countrycode":"PE","osm_type":"W","osm_id":1}},{"geometry":{"coordinates":[-79.024,-8.125]},"properties":{"street":"Calle Tomás Jefferson","housenumber":"123","city":"Trujillo","countrycode":"PE","osm_type":"N","osm_id":2}}]}`))
	})
	attachTestStreets(t, api)
	_, v := request(t, api, "GET", "/v1/autocomplete?q=Tomas+Jefferson+289&city=Trujillo&countrycodes=PE", "")
	if v["count"] != float64(1) || v["results"].([]any)[0].(map[string]any)["id"] != "street:trujillo" {
		t.Fatal(v)
	}
}

func TestStreetSearchPreservesActualAddressWhenAvailable(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"features":[{"geometry":{"coordinates":[-79.0241234,-8.1251234]},"properties":{"street":"Calle Tomás Jefferson","housenumber":"289","city":"Trujillo","countrycode":"PE","osm_type":"N","osm_id":3}}]}`))
	})
	attachTestStreets(t, api)
	_, v := request(t, api, "GET", "/v1/search?q=Tomas+Jefferson+289&city=Trujillo&countrycodes=PE", "")
	p := v["results"].([]any)[0].(map[string]any)
	if p["houseNumber"] != "289" || p["source"] != "photon" || p["latitude"] != -8.1251234 || p["longitude"] != -79.0241234 {
		t.Fatal(p)
	}
}

func TestStreetIndexAvailableDuringPhotonFailureAndStructuredSearch(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { http.Error(w, "offline", 500) })
	attachTestStreets(t, api)
	w, v := request(t, api, "GET", "/v1/geocode?street=Tomas+Jefferson&housenumber=289&city=Trujillo&countrycodes=PE", "")
	if w.Code != 200 || v["count"] != float64(1) || !strings.Contains(v["attribution"].(string), "Municipal public data") {
		t.Fatal(w.Code, v)
	}
}

func TestPlaceQueriesRemainPlacesAndStreetBatchUsesTheIndex(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"features":[{"geometry":{"coordinates":[-77.03,-12.05]},"properties":{"name":"Lima","city":"Lima","countrycode":"PE","type":"city","osm_type":"R","osm_id":7}}]}`))
	})
	attachTestStreets(t, api)
	index, err := newStreetIndex(append([]streetRecord{fixtureStreet("street:city-name", "Calle Lima", "Trujillo", -8.12, -79.02)}, api.streets.records[0].streetRecord))
	if err != nil {
		t.Fatal(err)
	}
	api.streets = index
	_, v := request(t, api, "GET", "/v1/search?q=Lima&countrycodes=PE", "")
	if v["results"].([]any)[0].(map[string]any)["placeName"] != "Lima" {
		t.Fatal("city query replaced with a street", v)
	}
	w, v := request(t, api, "POST", "/v1/batch", `{"items":[{"id":"one","query":"Tomas Jefferson 289, Trujillo","countrycodes":"PE"}]}`)
	if w.Code != 200 {
		t.Fatal(w.Code, v)
	}
	p := v["results"].([]any)[0].(map[string]any)
	if p["status"] != "ok" || p["result"].(map[string]any)["source"] != "mapora_streets" {
		t.Fatal(p)
	}
}

func TestEmbeddedPeruIndexIsNationalAndMunicipal(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{"features":[]}`)) })
	if err := api.ConfigurePeruStreets(); err != nil {
		t.Fatal(err)
	}
	if len(api.streets.records) < 100000 {
		t.Fatal("national data missing")
	}
	departments := map[string]bool{}
	for _, r := range api.streets.records {
		departments[r.State] = true
	}
	if len(departments) < 25 {
		t.Fatal(departments)
	}
	hits := api.streets.search("Tomás Jefferson 289", url.Values{"city": {"Trujillo"}}, url.Values{"countrycode": {"PE"}, "limit": {"5"}})
	if len(hits) == 0 || !strings.HasPrefix(hits[0].ID, "mpt:") || hits[0].HouseNumber != "" || hits[0].Match.RequestedHouseNumber != "289" {
		t.Fatal(hits)
	}
	if hits[0].Latitude < -8.13 || hits[0].Latitude > -8.12 || hits[0].Longitude < -79.03 || hits[0].Longitude > -79.02 {
		t.Fatal("municipal projection is outside the street area", hits[0])
	}
	runtime.GC()
	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	t.Logf("street index: %d records, heap %.1f MiB, heap reserved %.1f MiB", len(api.streets.records), float64(memory.HeapAlloc)/(1<<20), float64(memory.HeapSys)/(1<<20))
}

func BenchmarkPeruStreetLookup(b *testing.B) {
	api, _ := New("http://127.0.0.1:1")
	defer api.providerPace.Stop()
	if err := api.ConfigurePeruStreets(); err != nil {
		b.Fatal(err)
	}
	for _, tc := range []struct{ name, query, city string }{{"municipal", "Tomas Jefferson 289", "Trujillo"}, {"national", "Avenida Arequipa 123", "Lima"}, {"short-prefix", "Sa", ""}} {
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for n := 0; n < b.N; n++ {
				api.streets.search(tc.query, url.Values{"city": {tc.city}}, url.Values{"countrycode": {"PE"}, "limit": {"5"}})
			}
		})
	}
}
