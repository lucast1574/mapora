package mapsapi

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

func coordinateQuery(values url.Values) (float64, float64, error) {
	lng := values.Get("lng")
	if lng == "" {
		lng = values.Get("lon")
	}
	lat, a := strconv.ParseFloat(values.Get("lat"), 64)
	lon, b := strconv.ParseFloat(lng, 64)
	if a != nil || b != nil || !validCoordinates(lat, lon) {
		return 0, 0, errors.New("lat y lng deben ser coordenadas válidas")
	}
	return lat, lon, nil
}

func providerQuery(values url.Values) (url.Values, error) {
	query := url.Values{"limit": {"8"}}
	if raw := values.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 20 {
			return nil, errors.New("limit debe estar entre 1 y 20")
		}
		query.Set("limit", strconv.Itoa(n))
	}
	// The public index has en/de/fr translations; omission uses the local OSM name.
	lang := values.Get("lang")
	if lang != "" && lang != "local" && lang != "es" {
		if lang != "en" && lang != "de" && lang != "fr" {
			return nil, errors.New("lang debe ser es, local, en, de o fr")
		}
		query.Set("lang", lang)
	}
	countries := values.Get("countrycodes")
	if countries == "" {
		countries = values.Get("countrycode")
	}
	if countries != "" {
		codes := strings.Split(countries, ",")
		if len(codes) > 10 {
			return nil, errors.New("se permiten hasta 10 países")
		}
		for _, code := range codes {
			code = strings.ToUpper(strings.TrimSpace(code))
			if len(code) != 2 || code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z' {
				return nil, errors.New("usa códigos de país de dos letras")
			}
			query.Add("countrycode", code)
		}
	}
	if bbox := values.Get("bbox"); bbox != "" {
		parts := strings.Split(bbox, ",")
		nums := make([]float64, 4)
		if len(parts) != 4 {
			return nil, errors.New("bbox debe ser minLng,minLat,maxLng,maxLat")
		}
		for i, p := range parts {
			v, err := strconv.ParseFloat(p, 64)
			if err != nil || math.IsNaN(v) || math.IsInf(v, 0) {
				return nil, errors.New("bbox inválido")
			}
			nums[i] = v
		}
		if !validCoordinates(nums[1], nums[0]) || !validCoordinates(nums[3], nums[2]) || nums[0] >= nums[2] || nums[1] >= nums[3] {
			return nil, errors.New("bbox inválido")
		}
		query.Set("bbox", bbox)
	}
	return query, nil
}

func (s *API) search(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	values := r.URL.Query()
	text := strings.Join(strings.Fields(values.Get("q")), " ")
	if n := utf8.RuneCountInString(text); n < 2 || n > 200 {
		fail(w, 400, "invalid_query", "q debe tener entre 2 y 200 caracteres")
		return
	}
	query, err := providerQuery(values)
	if err != nil {
		fail(w, 400, "invalid_query", err.Error())
		return
	}
	query.Set("q", text)
	if values.Get("lat") != "" || values.Get("lng") != "" || values.Get("lon") != "" {
		lat, lng, err := coordinateQuery(values)
		if err != nil {
			fail(w, 400, "invalid_coordinates", err.Error())
			return
		}
		query.Set("lat", strconv.FormatFloat(lat, 'f', 5, 64))
		query.Set("lon", strconv.FormatFloat(lng, 'f', 5, 64))
	}
	body, cached, err := s.cache.get(r.Context(), "search:"+query.Encode(), 15*time.Minute, func(ctx context.Context) ([]byte, error) {
		results, err := s.photon(ctx, "/api/", query)
		if err != nil {
			return nil, err
		}
		return json.Marshal(map[string]any{"query": text, "results": results, "count": len(results), "attribution": attribution})
	})
	if err != nil {
		fail(w, 502, "search_unavailable", "No se pudo consultar el motor de búsqueda. Reintenta.")
		return
	}
	respond(w, body, cached, start)
}

func (s *API) reversePlace(ctx context.Context, lat, lng float64) (Place, error) {
	query := url.Values{"lat": {strconv.FormatFloat(lat, 'f', 6, 64)}, "lon": {strconv.FormatFloat(lng, 'f', 6, 64)}, "limit": {"1"}, "radius": {"1"}}
	body, _, err := s.cache.get(ctx, "reverse:"+query.Encode(), 24*time.Hour, func(job context.Context) ([]byte, error) {
		results, err := s.photon(job, "/reverse", query)
		if err != nil {
			return nil, err
		}
		if len(results) == 0 {
			return nil, errors.New("no hay dirección cercana")
		}
		return json.Marshal(results[0])
	})
	if err != nil {
		return Place{}, err
	}
	var place Place
	err = json.Unmarshal(body, &place)
	return place, err
}
