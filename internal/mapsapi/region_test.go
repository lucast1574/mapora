package mapsapi

import (
	"context"
	"net/http"
	"net/url"
	"testing"
)

func TestAmericasCoverageIncludesTerritoriesAndExcludesOtherContinents(t *testing.T) {
	for _, tc := range []struct {
		code     string
		lat, lon float64
		ok       bool
	}{{"PE", -12, -77, true}, {"CA", 49, -123, true}, {"US", 21, -157, true}, {"US", 52, 173, true}, {"GL", 70, -20, true}, {"FR", 4.9, -52.3, true}, {"FR", 48.8, 2.3, false}, {"FR", -17, -149, false}, {"GB", 32, -64, true}, {"GB", 51, 0, false}, {"JP", 35, 139, false}, {"NZ", -40, 175, false}} {
		if got := americasPlace(Place{CountryCode: tc.code, Latitude: tc.lat, Longitude: tc.lon}); got != tc.ok {
			t.Fatal(tc, got)
		}
	}
	q := url.Values{"q": {"Lima"}}
	regional := americasQuery(q)
	if len(regional["countrycode"]) < 40 || len(q["countrycode"]) != 0 {
		t.Fatal("scope did not clone the query")
	}
	q.Set("countrycode", "PE")
	if americasQuery(q).Get("countrycode") != "PE" {
		t.Fatal("explicit filter lost")
	}
}

// Photon reverse rejects countrycode and bbox; constrain its returned places instead.
func TestRegionalReverseUsesSupportedPhotonParameters(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reverse" || r.URL.Query().Has("countrycode") || r.URL.Query().Has("bbox") {
			t.Errorf("unsupported reverse request: %s", r.URL.String())
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Write([]byte(photonFixture))
	})
	api.RestrictToAmericas()
	results, err := api.photon(context.Background(), "/reverse", url.Values{"lat": {"-12.12"}, "lon": {"-77.03"}, "osm_tag": {"amenity:pharmacy"}})
	if err != nil || len(results) != 1 {
		t.Fatalf("reverse failed: %v, results %v", err, results)
	}
}
