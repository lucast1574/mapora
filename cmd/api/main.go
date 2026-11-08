package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/lucast1574/mapora/internal/mapsapi"
	"github.com/lucast1574/mapora/internal/platform"
	"github.com/lucast1574/mapora/web"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	provider := os.Getenv("PHOTON_BASE_URL")
	if provider == "" {
		provider = "https://photon.komoot.io"
	}
	interval := 500
	if raw := os.Getenv("PHOTON_MIN_INTERVAL_MS"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			slog.Error("invalid PHOTON_MIN_INTERVAL_MS")
			os.Exit(1)
		}
		interval = parsed
	}
	api, err := mapsapi.NewWithInterval(provider, time.Duration(interval)*time.Millisecond)
	if err != nil {
		slog.Error("configuration failed", "error", err)
		os.Exit(1)
	}
	if os.Getenv("DATABASE_URL") == "" {
		slog.Error("DATABASE_URL is required; refusing unauthenticated startup")
		os.Exit(1)
	}
	if err := api.ConfigurePeruStreets(); err != nil {
		slog.Error("Peru street index configuration failed", "error", err)
		os.Exit(1)
	}
	if err := api.ConfigureRouting(os.Getenv("ROUTING_BASE_URL")); err != nil {
		slog.Error("routing configuration failed", "error", err)
		os.Exit(1)
	}
	if err := api.SetRoutingCoverage(os.Getenv("ROUTING_COVERAGE")); err != nil {
		slog.Error("invalid routing coverage")
		os.Exit(1)
	}
	if err := api.ConfigureTiles(os.Getenv("TILE_BASE_URL")); err != nil {
		slog.Error("invalid tile configuration")
		os.Exit(1)
	}
	geo := api.Handler()
	site := web.Handler()
	combined := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/status" || r.URL.Path == "/health" || r.URL.Path == "/openapi.json" || strings.HasPrefix(r.URL.Path, "/v1/") || r.URL.Path == "/search" || r.URL.Path == "/reverse" || r.URL.Path == "/maps/resolve" {
			geo.ServeHTTP(w, r)
		} else {
			site.ServeHTTP(w, r)
		}
	})
	startup, cancelStartup := context.WithTimeout(context.Background(), 30*time.Second)
	app, err := platform.New(startup, platform.Config{TileURL: os.Getenv("TILE_BASE_URL"), DatabaseURL: os.Getenv("DATABASE_URL"), FirebaseProjectID: os.Getenv("FIREBASE_PROJECT_ID"), FirebaseAPIKey: os.Getenv("FIREBASE_API_KEY"), FirebaseAppID: os.Getenv("FIREBASE_APP_ID"), AdminEmail: os.Getenv("ADMIN_EMAIL"), AdminPassword: os.Getenv("ADMIN_PASSWORD"), AppURL: os.Getenv("APP_URL"), SiteURL: os.Getenv("SITE_URL"), StripeKey: os.Getenv("STRIPE_SECRET_KEY"), StripeWebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"), StripePortalConfig: os.Getenv("STRIPE_PORTAL_CONFIG"), StripePrices: map[string]string{"launch": os.Getenv("STRIPE_PRICE_LAUNCH"), "scale": os.Getenv("STRIPE_PRICE_SCALE")}, ResendKey: os.Getenv("RESEND_API_KEY"), MailFrom: os.Getenv("MAIL_FROM")}, combined)
	cancelStartup()
	if err != nil {
		slog.Error("platform startup failed", "error", err)
		os.Exit(1)
	}
	defer app.Close()
	server := &http.Server{Addr: ":" + port, Handler: app.Handler(), ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 10 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go app.Maintain(ctx)
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	slog.Info("maps API listening", "port", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
