package mapsapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type API struct {
	provider      string
	upstream      *http.Client
	google        *http.Client
	cache         *cache
	providerSlots chan struct{}
	providerPace  *time.Ticker
	requests      chan struct{}
}

func New(provider string) (*API, error) {
	u, err := url.Parse(provider)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, errors.New("invalid PHOTON_BASE_URL")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxIdleConnsPerHost = 16
	transport.MaxConnsPerHost = 16
	return &API{provider: strings.TrimRight(provider, "/"), upstream: &http.Client{Transport: transport, Timeout: 7 * time.Second},
		google: &http.Client{Transport: transport, Timeout: 7 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }},
		cache:  newCache(), providerSlots: make(chan struct{}, 4), providerPace: time.NewTicker(500 * time.Millisecond), requests: make(chan struct{}, 64)}, nil
}

func (s *API) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{
			"service": "Nexode Maps API", "version": "1.0.0", "authentication": "none", "docs": "/openapi.json",
			"endpoints":   map[string]string{"search": "GET /v1/search?q=Miraflores&countrycodes=pe", "reverse": "GET /v1/reverse?lat=-12.12&lng=-77.03", "resolve": "POST /v1/resolve {\"url\":\"https://maps.app.goo.gl/...\"}"},
			"attribution": attribution})
	})
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "service": "nexode-maps-api"})
	})
	mux.HandleFunc("GET /openapi.json", serveOpenAPI)
	for _, path := range []string{"/v1/search", "/search"} {
		mux.HandleFunc("GET "+path, s.search)
	}
	for _, path := range []string{"/v1/reverse", "/reverse"} {
		mux.HandleFunc("GET "+path, s.reverse)
	}
	for _, path := range []string{"/v1/resolve", "/maps/resolve"} {
		mux.HandleFunc("POST "+path, s.resolveHTTP)
		mux.HandleFunc("GET "+path, s.resolveHTTP)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		w.Header().Set("Access-Control-Expose-Headers", "X-Cache, X-Quota-Limit, X-Quota-Remaining, X-Quota-Reset, Retry-After")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.WriteHeader(204)
			return
		}
		select {
		case s.requests <- struct{}{}:
			defer func() { <-s.requests }()
		default:
			fail(w, 503, "busy", "Servicio ocupado. Reintenta en un momento.")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
		defer cancel()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func fail(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": message, "code": code})
}

func respond(w http.ResponseWriter, body []byte, cached bool, start time.Time) {
	var result map[string]any
	if json.Unmarshal(body, &result) != nil {
		fail(w, 500, "internal", "Respuesta inválida")
		return
	}
	result["cached"], result["tookMs"] = cached, time.Since(start).Milliseconds()
	if cached {
		w.Header().Set("X-Cache", "HIT")
	} else {
		w.Header().Set("X-Cache", "MISS")
	}
	writeJSON(w, 200, result)
}
