package mapsapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const photonFixture = `{"features":[{"geometry":{"coordinates":[-77.031,-12.046]},"properties":{"name":"Nearby cafe","street":"Jirón de la Unión","housenumber":"123","district":"Centro","city":"Lima","state":"Lima","country":"Perú","countrycode":"PE","osm_type":"N","osm_id":123}}]}`

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func testAPI(t *testing.T, provider http.HandlerFunc) *API {
	t.Helper()
	upstream := httptest.NewServer(provider)
	t.Cleanup(upstream.Close)
	api, err := New(upstream.URL)
	if err != nil {
		t.Fatal(err)
	}
	api.providerPace.Stop()
	api.providerPace = time.NewTicker(time.Millisecond)
	t.Cleanup(api.providerPace.Stop)
	return api
}

func request(t *testing.T, api *API, method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	w := httptest.NewRecorder()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	api.Handler().ServeHTTP(w, r)
	var value map[string]any
	if w.Code != 204 {
		if err := json.Unmarshal(w.Body.Bytes(), &value); err != nil {
			t.Fatalf("invalid JSON: %s", w.Body)
		}
	}
	return w, value
}

func TestCoordinatesAndURLBoundaries(t *testing.T) {
	for _, raw := range []string{"https://www.google.com/maps?q=0%2C-78", "https://maps.google.com/?q=loc:0,-78", "https://www.google.com/maps/@1,-77,17z/data=!3d0!4d-78"} {
		lat, lng, ok := coordinates(raw)
		if !ok || lat != 0 || lng != -78 {
			t.Fatalf("wrong pin for %s", raw)
		}
	}
	for _, raw := range []string{"https://www.google.com.evil.example/maps?q=0,-78", "https://google.com@127.0.0.1/maps", "http://www.google.com/maps", "https://google.com:8443/maps", "https://consent.google.com/?continue=https://example.com"} {
		if googleURL(raw, false) {
			t.Fatalf("unsafe URL accepted: %s", raw)
		}
	}
	if _, _, ok := coordinates("?q=91,181"); ok {
		t.Fatal("out of bounds")
	}
}

func TestResolveKeepsNameExactPinAndExpandedURL(t *testing.T) {
	var requests atomic.Int32
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { requests.Add(1); w.Write([]byte(photonFixture)) })
	var googleRequests atomic.Int32
	target := "https://www.google.com/maps/place/Sal%C3%B3n+Elegido/@-12.04,-77.02,17z/data=!3d-12.0453!4d-77.0309"
	api.google.Transport = roundTrip(func(r *http.Request) (*http.Response, error) {
		googleRequests.Add(1)
		return &http.Response{StatusCode: 302, Header: http.Header{"Location": {target}}, Body: io.NopCloser(strings.NewReader(""))}, nil
	})
	for i := 0; i < 2; i++ {
		w, value := request(t, api, "POST", "/v1/resolve", `{"url":"https://maps.app.goo.gl/example"}`)
		if w.Code != 200 || value["latitude"] != -12.0453 || value["longitude"] != -77.0309 || value["placeName"] != "Salón Elegido" || value["resolved_url"] != target {
			t.Fatalf("incorrect resolved data: %s", w.Body)
		}
		if value["matchedPlaceName"] != "Nearby cafe" || value["addressStatus"] != "resolved" || !strings.HasPrefix(value["address"].(string), "Salón Elegido · ") {
			t.Fatal(value)
		}
	}
	if googleRequests.Load() != 1 || requests.Load() != 1 {
		t.Fatal("cache did not avoid repeat requests")
	}
}

func TestResolveFastPathAndProviderFailureKeepUsableLocation(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) })
	api.google.Transport = roundTrip(func(*http.Request) (*http.Response, error) {
		t.Error("unexpected Google request")
		return nil, errors.New("unexpected")
	})
	for _, tc := range []struct{ body, status string }{
		{`{"url":"https://www.google.com/maps/place/Local/@0,-78,17z","includeAddress":false}`, "not_requested"},
		{`{"url":"https://www.google.com/maps/place/Local/@0,-78,17z"}`, "unavailable"},
	} {
		w, value := request(t, api, "POST", "/maps/resolve", tc.body)
		if w.Code != 200 || value["placeName"] != "Local" || value["latitude"] != float64(0) || value["longitude"] != float64(-78) || value["addressStatus"] != tc.status {
			t.Fatal(w.Code, value)
		}
	}
}

func TestUnsafeRedirectNeverLeavesGoogle(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected provider") })
	var calls int
	api.google.Transport = roundTrip(func(*http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 302, Header: http.Header{"Location": {"http://169.254.169.254/"}}, Body: io.NopCloser(strings.NewReader(""))}, nil
	})
	w, _ := request(t, api, "POST", "/v1/resolve", `{"url":"https://maps.app.goo.gl/test"}`)
	if w.Code != 422 || calls != 1 {
		t.Fatal(w.Code, calls)
	}
}

func TestSearchFiltersCORSAndCache(t *testing.T) {
	var calls atomic.Int32
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/api/" || r.URL.Query().Get("countrycode") != "PE" || r.URL.Query().Get("lat") != "-12.12000" || r.URL.Query().Get("lang") != "" {
			t.Error(r.URL)
		}
		w.Write([]byte(photonFixture))
	})
	for i := 0; i < 2; i++ {
		w, value := request(t, api, "GET", "/v1/search?q=Larco&countrycodes=pe&lat=-12.12&lng=-77.03&lang=es", "")
		if w.Code != 200 || value["count"] != float64(1) || w.Header().Get("Access-Control-Allow-Origin") != "*" {
			t.Fatal(w.Code, value)
		}
		results := value["results"].([]any)
		place := results[0].(map[string]any)
		if place["street"] != "Jirón de la Unión" || place["houseNumber"] != "123" || place["countryCode"] != "PE" || place["placeName"] != "Nearby cafe" {
			t.Fatal(place)
		}
	}
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
	w, _ := request(t, api, "OPTIONS", "/v1/resolve", "")
	if w.Code != 204 {
		t.Fatal(w.Code)
	}
}

func TestInvalidInputsDoNotReachProviders(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected external call") })
	for _, path := range []string{"/v1/search?q=a", "/v1/search?q=Lima&limit=21", "/v1/search?q=Lima&lat=NaN&lng=0", "/v1/search?q=Lima&bbox=1,2,0,3", "/v1/search?q=Lima&countrycodes=PER", "/v1/reverse?lat=91&lng=0", "/v1/reverse?lat=0&lng=Inf"} {
		w, _ := request(t, api, "GET", path, "")
		if w.Code != 400 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	for _, body := range []string{`{"url":"https://example.com/?q=0,-78"}`, `{"url":"https://www.google.com/maps?q=0,-78"} {}`, `{"url":"https://www.google.com/maps?q=0,-78","includeAddress":"no"}`} {
		w, _ := request(t, api, "POST", "/v1/resolve", body)
		if w.Code != 400 {
			t.Fatal(w.Code)
		}
	}
}

func TestReverseDoesNotMoveRequestedPoint(t *testing.T) {
	api := testAPI(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(photonFixture)) })
	w, value := request(t, api, "GET", "/v1/reverse?lat=-12.0453&lng=-77.0309", "")
	if w.Code != 200 || value["latitude"] != -12.0453 || value["longitude"] != -77.0309 || value["matchedLatitude"] != -12.046 {
		t.Fatal(value)
	}
}

func TestCacheSharesWorkAndSurvivesCallerCancellation(t *testing.T) {
	c := newCache()
	var calls atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	load := func(context.Context) ([]byte, error) {
		calls.Add(1)
		close(started)
		<-release
		return []byte(`{"ok":true}`), nil
	}
	ctx, cancel := context.WithCancel(context.Background())
	first := make(chan error, 1)
	go func() { _, _, err := c.get(ctx, "same", time.Minute, load); first <- err }()
	<-started
	cancel()
	if !errors.Is(<-first, context.Canceled) {
		t.Fatal("cancellation not respected")
	}
	var group sync.WaitGroup
	for i := 0; i < 10; i++ {
		group.Go(func() {
			body, _, err := c.get(context.Background(), "same", time.Minute, load)
			if err != nil || string(body) != `{"ok":true}` {
				t.Error(err)
			}
		})
	}
	close(release)
	group.Wait()
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
}

func TestOpenAPIAndHealth(t *testing.T) {
	api := testAPI(t, func(http.ResponseWriter, *http.Request) { t.Error("health contacted provider") })
	w, value := request(t, api, "GET", "/health", "")
	if w.Code != 200 || value["status"] != "ok" {
		t.Fatal(value)
	}
	w, value = request(t, api, "GET", "/openapi.json", "")
	if w.Code != 200 || value["openapi"] != "3.1.0" {
		t.Fatal(value)
	}
}

func TestStreetResultIncludesStreetNameInStreetAddress(t *testing.T) {
	var f feature
	if err := json.Unmarshal([]byte(`{"geometry":{"coordinates":[-77.03,-12.12]},"properties":{"type":"street","name":"Avenida José Larco","city":"Miraflores","country":"Perú","osm_type":"W","osm_id":569493965}}`), &f); err != nil {
		t.Fatal(err)
	}
	p, ok := f.place()
	if !ok || p.Street != "Avenida José Larco" || !strings.HasPrefix(p.StreetAddress, "Avenida José Larco, ") || p.Address != p.StreetAddress {
		t.Fatal(p)
	}
}
