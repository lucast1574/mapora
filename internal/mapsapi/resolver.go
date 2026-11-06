package mapsapi

import (
	"context"
	"errors"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type pin struct {
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	PlaceName   string  `json:"placeName"`
	ResolvedURL string  `json:"resolved_url"`
}

var errUnresolved = errors.New("No se pudieron extraer las coordenadas del enlace de Google Maps")

func (s *API) resolve(ctx context.Context, raw string) (pin, error) {
	current := raw
	for hop := 0; hop < 6; hop++ {
		if !googleURL(current, true) {
			return pin{}, errUnresolved
		}
		u, _ := url.Parse(current)
		if u.Hostname() == "consent.google.com" {
			next := u.Query().Get("continue")
			if !googleURL(next, false) {
				return pin{}, errUnresolved
			}
			current = next
		}
		if lat, lng, ok := coordinates(current); ok {
			return pin{lat, lng, placeName(current), current}, nil
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, current, nil)
		if err != nil {
			return pin{}, err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36")
		req.Header.Set("Accept-Language", "es,en;q=0.7")
		response, err := s.google.Do(req)
		if err != nil {
			return pin{}, err
		}
		if response.StatusCode >= 300 && response.StatusCode < 400 {
			location := response.Header.Get("Location")
			response.Body.Close()
			next, err := u.Parse(location)
			if location == "" || err != nil || !googleURL(next.String(), true) {
				return pin{}, errUnresolved
			}
			current = next.String()
			continue
		}
		if response.StatusCode != http.StatusOK {
			response.Body.Close()
			return pin{}, errUnresolved
		}
		body, err := io.ReadAll(io.LimitReader(response.Body, 512<<10))
		response.Body.Close()
		if err != nil {
			return pin{}, err
		}
		text := html.UnescapeString(string(body))
		if lat, lng, ok := coordinates(text); ok {
			return pin{lat, lng, placeName(current), current}, nil
		}
		return pin{}, errUnresolved
	}
	return pin{}, errUnresolved
}

func displayAddress(name, address string) string {
	if name == "" {
		return address
	}
	lower := strings.ToLower(address)
	if lower == strings.ToLower(name) || strings.HasPrefix(lower, strings.ToLower(name)+",") {
		return address
	}
	if address == "" {
		return name
	}
	return name + " · " + address
}
