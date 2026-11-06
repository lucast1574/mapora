package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/lucast1574/nexode-maps-api/internal/mapsapi"
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
	api, err := mapsapi.New(provider)
	if err != nil {
		slog.Error("configuration failed", "error", err)
		os.Exit(1)
	}
	server := &http.Server{Addr: ":" + port, Handler: api.Handler(), ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
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
