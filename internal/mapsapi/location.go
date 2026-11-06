package mapsapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type location struct {
	Place
	ResolvedURL      string   `json:"resolved_url,omitempty"`
	AddressStatus    string   `json:"addressStatus"`
	MatchedPlaceName string   `json:"matchedPlaceName,omitempty"`
	MatchedLatitude  *float64 `json:"matchedLatitude,omitempty"`
	MatchedLongitude *float64 `json:"matchedLongitude,omitempty"`
}

func (s *API) enrich(ctx context.Context, p pin, original string, address bool) location {
	result := location{Place: Place{Latitude: p.Latitude, Longitude: p.Longitude, PlaceName: p.PlaceName,
		GoogleMapsLink: original, Source: "google_maps", Attribution: attribution}, ResolvedURL: p.ResolvedURL, AddressStatus: "not_requested"}
	if address {
		place, err := s.reversePlace(ctx, p.Latitude, p.Longitude)
		if err == nil {
			result.Place = place
			result.MatchedPlaceName = place.PlaceName
			result.MatchedLatitude, result.MatchedLongitude = &place.Latitude, &place.Longitude
			result.AddressStatus = "resolved"
		} else {
			result.AddressStatus = "unavailable"
		}
	}
	// Reverse-geocoding may describe a nearby POI. Keep Google's selected name and exact pin.
	result.Latitude, result.Longitude = p.Latitude, p.Longitude
	result.PlaceName, result.Source, result.GoogleMapsLink = p.PlaceName, "google_maps", original
	if result.StreetAddress == "" {
		result.StreetAddress = fmt.Sprintf("%.6f, %.6f", p.Latitude, p.Longitude)
	}
	result.Address = displayAddress(p.PlaceName, result.StreetAddress)
	return result
}

func (s *API) resolveHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	in := struct {
		URL            string `json:"url"`
		IncludeAddress *bool  `json:"includeAddress"`
	}{}
	if r.Method == http.MethodGet {
		in.URL = r.URL.Query().Get("url")
		if raw := r.URL.Query().Get("includeAddress"); raw != "" {
			value, err := strconv.ParseBool(raw)
			if err != nil {
				fail(w, 400, "invalid_input", "includeAddress debe ser true o false")
				return
			}
			in.IncludeAddress = &value
		}
	} else {
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&in) != nil {
			fail(w, 400, "invalid_input", "Envía JSON con url e includeAddress opcional")
			return
		}
		if err := decoder.Decode(&struct{}{}); err != io.EOF {
			fail(w, 400, "invalid_input", "Envía un único objeto JSON")
			return
		}
	}
	in.URL = strings.TrimSpace(in.URL)
	if len(in.URL) > 4096 || !googleURL(in.URL, false) {
		fail(w, 400, "invalid_url", "Pega un enlace HTTPS válido de Google Maps")
		return
	}
	address := in.IncludeAddress == nil || *in.IncludeAddress
	body, cached, err := s.cache.get(r.Context(), "pin:"+in.URL, 24*time.Hour, func(ctx context.Context) ([]byte, error) {
		p, err := s.resolve(ctx, in.URL)
		if err != nil {
			return nil, err
		}
		return json.Marshal(p)
	})
	if err != nil {
		fail(w, 422, "unresolved_link", errUnresolved.Error())
		return
	}
	var p pin
	if json.Unmarshal(body, &p) != nil {
		fail(w, 500, "internal", "Respuesta inválida")
		return
	}
	result := s.enrich(r.Context(), p, in.URL, address)
	encoded, _ := json.Marshal(result)
	respond(w, encoded, cached, start)
}

func (s *API) reverse(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	lat, lng, err := coordinateQuery(r.URL.Query())
	if err != nil {
		fail(w, 400, "invalid_coordinates", err.Error())
		return
	}
	// Coordinates are the user's requested point, never silently moved to a nearby POI.
	key := fmt.Sprintf("location:%.17g,%.17g", lat, lng)
	body, cached, err := s.cache.get(r.Context(), key, 24*time.Hour, func(ctx context.Context) ([]byte, error) {
		place, err := s.reversePlace(ctx, lat, lng)
		if err != nil {
			return nil, err
		}
		result := location{Place: place, AddressStatus: "resolved", MatchedLatitude: &place.Latitude, MatchedLongitude: &place.Longitude}
		result.Latitude, result.Longitude = lat, lng
		result.GoogleMapsLink = fmt.Sprintf("https://www.google.com/maps?q=%.6f,%.6f", lat, lng)
		return json.Marshal(result)
	})
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			fail(w, 504, "timeout", "La consulta de dirección agotó el tiempo de espera")
		} else {
			fail(w, 502, "reverse_unavailable", "No se pudo obtener una dirección cercana")
		}
		return
	}
	respond(w, body, cached, start)
}
