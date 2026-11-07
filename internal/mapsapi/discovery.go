package mapsapi

import (
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// AddressQuality describes available source fields, never a delivery guarantee.
type AddressQuality struct {
	Precision string   `json:"precision"`
	Missing   []string `json:"missingFields"`
	Verified  bool     `json:"verified"`
}

func quality(p Place, kind string) AddressQuality {
	q := AddressQuality{Precision: kind, Missing: []string{}}
	if q.Precision == "" {
		q.Precision = "place"
	}
	if p.Street != "" {
		q.Precision = "street"
	}
	if p.HouseNumber != "" {
		q.Precision = "address"
	}
	for _, f := range []struct{ name, value string }{{"street", p.Street}, {"houseNumber", p.HouseNumber}, {"city", p.City}, {"postcode", p.Postcode}} {
		if f.value == "" {
			q.Missing = append(q.Missing, f.name)
		}
	}
	return q
}
func decodeInput(w http.ResponseWriter, r *http.Request, v any, limit int64) bool {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	d.DisallowUnknownFields()
	if d.Decode(v) != nil || d.Decode(&struct{}{}) != io.EOF {
		fail(w, 400, "invalid_input", "Envía un único objeto JSON válido con los campos documentados.")
		return false
	}
	return true
}
func (s *API) structured(w http.ResponseWriter, r *http.Request) {
	query, err := providerQuery(r.URL.Query())
	if err != nil {
		fail(w, 400, "invalid_query", err.Error())
		return
	}
	fields := 0
	for _, key := range []string{"street", "housenumber", "city", "district", "state", "postcode", "county"} {
		v := strings.Join(strings.Fields(r.URL.Query().Get(key)), " ")
		if len(v) > 200 {
			fail(w, 400, "invalid_query", "Cada campo admite hasta 200 bytes.")
			return
		}
		if v != "" {
			query.Set(key, v)
			fields++
		}
	}
	if fields == 0 {
		fail(w, 400, "invalid_query", "Indica al menos una calle, ciudad u otro componente de dirección.")
		return
	}
	s.discover(w, r, "/structured", query)
}
func (s *API) discover(w http.ResponseWriter, r *http.Request, path string, query url.Values) {
	start := time.Now()
	body, cached, err := s.cache.get(r.Context(), "street-search-v1:"+path+":"+query.Encode(), 15*time.Minute, func(ctx context.Context) ([]byte, error) {
		results, err := s.searchPlaces(ctx, path, query, r.URL.Query())
		if err != nil {
			return nil, err
		}
		return json.Marshal(map[string]any{"results": results, "count": len(results), "attribution": searchAttribution(results)})
	})
	if err != nil {
		fail(w, 502, "search_unavailable", "No se pudo consultar el motor de búsqueda. Reintenta.")
		return
	}
	respond(w, body, cached, start)
}

var categories = map[string]string{"pharmacy": "amenity:pharmacy", "restaurant": "amenity:restaurant", "hospital": "amenity:hospital", "fuel": "amenity:fuel", "supermarket": "shop:supermarket", "hotel": "tourism:hotel", "bank": "amenity:bank", "parking": "amenity:parking", "cafe": "amenity:cafe"}

func distanceMeters(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180
	a := math.Pow(math.Sin((lat2-lat1)*rad/2), 2) + math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Pow(math.Sin((lon2-lon1)*rad/2), 2)
	return 6371000 * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(math.Max(0, 1-a)))
}
func (s *API) nearby(w http.ResponseWriter, r *http.Request) {
	lat, lng, err := coordinateQuery(r.URL.Query())
	if err != nil {
		fail(w, 400, "invalid_coordinates", err.Error())
		return
	}
	tag, ok := categories[r.URL.Query().Get("category")]
	if !ok {
		fail(w, 400, "invalid_category", "Categorías: pharmacy, restaurant, hospital, fuel, supermarket, hotel, bank, parking, cafe.")
		return
	}
	radius := 5000.0
	if raw := r.URL.Query().Get("radius"); raw != "" {
		radius, err = strconv.ParseFloat(raw, 64)
	}
	if err != nil || math.IsNaN(radius) || radius < 50 || radius > 50000 {
		fail(w, 400, "invalid_radius", "radius se expresa en metros, entre 50 y 50000.")
		return
	}
	query, err := providerQuery(r.URL.Query())
	if err != nil {
		fail(w, 400, "invalid_query", err.Error())
		return
	}
	query.Set("lat", strconv.FormatFloat(lat, 'f', 7, 64))
	query.Set("lon", strconv.FormatFloat(lng, 'f', 7, 64))
	query.Set("radius", strconv.FormatFloat(radius/1000, 'f', 3, 64))
	query.Set("osm_tag", tag)
	start := time.Now()
	body, cached, err := s.cache.get(r.Context(), "nearby:"+query.Encode(), 15*time.Minute, func(ctx context.Context) ([]byte, error) {
		results, err := s.photon(ctx, "/reverse", query)
		if err != nil {
			return nil, err
		}
		filtered := []Place{}
		for _, p := range results {
			d := distanceMeters(lat, lng, p.Latitude, p.Longitude)
			if d <= radius {
				p.DistanceMeters = &d
				filtered = append(filtered, p)
			}
		}
		sort.SliceStable(filtered, func(i, j int) bool { return *filtered[i].DistanceMeters < *filtered[j].DistanceMeters })
		return json.Marshal(map[string]any{"results": filtered, "count": len(filtered), "radiusMeters": radius, "distanceType": "straight_line", "category": r.URL.Query().Get("category"), "attribution": attribution})
	})
	if err != nil {
		fail(w, 502, "search_unavailable", "No se pudieron obtener lugares cercanos.")
		return
	}
	respond(w, body, cached, start)
}

type batchItem struct {
	ID           string `json:"id"`
	Query        string `json:"query"`
	CountryCodes string `json:"countrycodes,omitempty"`
}

func (s *API) batch(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Items []batchItem `json:"items"`
	}
	if !decodeInput(w, r, &in, 32<<10) {
		return
	}
	if len(in.Items) < 1 || len(in.Items) > 10 {
		fail(w, 400, "batch_limit", "Envía de 1 a 10 direcciones por petición; divide archivos mayores en lotes.")
		return
	}
	for _, item := range in.Items {
		if len(item.ID) > 80 || len(item.Query) < 2 || len(item.Query) > 200 {
			fail(w, 400, "invalid_input", "Cada elemento necesita query de 2–200 bytes e id opcional de hasta 80 bytes.")
			return
		}
		if _, err := providerQuery(url.Values{"countrycodes": {item.CountryCodes}}); err != nil {
			fail(w, 400, "invalid_query", err.Error())
			return
		}
	}
	results := make([]map[string]any, len(in.Items))
	var wg sync.WaitGroup
	jobs := make(chan int)
	for n := 0; n < 2; n++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range jobs {
				item := in.Items[i]
				q, _ := providerQuery(url.Values{"countrycodes": {item.CountryCodes}, "limit": {"1"}})
				q.Set("q", item.Query)
				body, _, err := s.cache.get(r.Context(), "batch-street-v1:"+q.Encode(), 15*time.Minute, func(ctx context.Context) ([]byte, error) {
					places, e := s.searchPlaces(ctx, "/api/", q, url.Values{})
					if e != nil {
						return nil, e
					}
					return json.Marshal(places)
				})
				result := map[string]any{"id": item.ID, "query": item.Query, "status": "ok"}
				var places []Place
				if err != nil {
					result["status"] = "error"
					result["code"] = "search_unavailable"
				} else if json.Unmarshal(body, &places) != nil {
					result["status"] = "error"
					result["code"] = "invalid_response"
				} else if len(places) == 0 {
					result["status"] = "not_found"
				} else {
					result["result"] = places[0]
				}
				results[i] = result
			}
		}()
	}
	for i := range in.Items {
		jobs <- i
	}
	close(jobs)
	wg.Wait()
	places := []Place{}
	for _, result := range results {
		if p, ok := result["result"].(Place); ok {
			places = append(places, p)
		}
	}
	writeJSON(w, 200, map[string]any{"results": results, "count": len(results), "attribution": searchAttribution(places)})
}
