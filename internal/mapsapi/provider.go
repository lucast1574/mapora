package mapsapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const attribution = "© OpenStreetMap contributors"

type Place struct {
	ID             string  `json:"id,omitempty"`
	PlaceName      string  `json:"placeName"`
	Address        string  `json:"address"`
	StreetAddress  string  `json:"streetAddress"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	Street         string  `json:"street,omitempty"`
	HouseNumber    string  `json:"houseNumber,omitempty"`
	District       string  `json:"district,omitempty"`
	City           string  `json:"city,omitempty"`
	State          string  `json:"state,omitempty"`
	Country        string  `json:"country,omitempty"`
	CountryCode    string  `json:"countryCode,omitempty"`
	Postcode       string  `json:"postcode,omitempty"`
	GoogleMapsLink string  `json:"googleMapsLink"`
	Source         string  `json:"source"`
	Attribution    string  `json:"attribution"`
}

type feature struct {
	Geometry struct {
		Coordinates []float64 `json:"coordinates"`
	} `json:"geometry"`
	Properties struct {
		Type        string `json:"type"`
		Name        string `json:"name"`
		Street      string `json:"street"`
		HouseNumber string `json:"housenumber"`
		District    string `json:"district"`
		City        string `json:"city"`
		State       string `json:"state"`
		County      string `json:"county"`
		Country     string `json:"country"`
		CountryCode string `json:"countrycode"`
		Postcode    string `json:"postcode"`
		Locality    string `json:"locality"`
		OSMType     string `json:"osm_type"`
		OSMID       int64  `json:"osm_id"`
	} `json:"properties"`
}

func (f feature) place() (Place, bool) {
	if len(f.Geometry.Coordinates) != 2 {
		return Place{}, false
	}
	lng, lat := f.Geometry.Coordinates[0], f.Geometry.Coordinates[1]
	if !validCoordinates(lat, lng) {
		return Place{}, false
	}
	p := f.Properties
	// Photon represents a street itself with name/type, without a street property.
	if p.Street == "" && p.Type == "street" {
		p.Street = p.Name
	}
	street := strings.TrimSpace(p.Street + " " + p.HouseNumber)
	address := joinUnique(street, p.Locality, p.District, p.City, p.County, p.State, p.Postcode, p.Country)
	if address == "" {
		address = p.Name
	}
	return Place{ID: fmt.Sprintf("osm:%s:%d", p.OSMType, p.OSMID), PlaceName: p.Name,
		Address: displayAddress(p.Name, address), StreetAddress: address, Latitude: lat, Longitude: lng,
		Street: p.Street, HouseNumber: p.HouseNumber, District: p.District, City: p.City, State: p.State,
		Country: p.Country, CountryCode: p.CountryCode, Postcode: p.Postcode,
		GoogleMapsLink: fmt.Sprintf("https://www.google.com/maps?q=%.6f,%.6f", lat, lng), Source: "photon", Attribution: attribution}, true
}

func (s *API) photon(ctx context.Context, path string, query url.Values) ([]Place, error) {
	select {
	case s.providerSlots <- struct{}{}:
		defer func() { <-s.providerSlots }()
	default:
		return nil, errors.New("motor de búsqueda ocupado")
	}
	// Keep shared public-provider traffic modest; cache hits bypass this gate.
	select {
	case <-s.providerPace.C:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.provider+path+"?"+query.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "NexodeMaps/1.0 (+https://maps-api.nexode.app)")
	response, err := s.upstream.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, fmt.Errorf("motor de búsqueda respondió %d", response.StatusCode)
	}
	var collection struct {
		Features []feature `json:"features"`
	}
	if err = json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(&collection); err != nil {
		return nil, errors.New("respuesta inválida del motor de búsqueda")
	}
	results := make([]Place, 0, len(collection.Features))
	seen := map[string]bool{}
	for _, f := range collection.Features {
		p, ok := f.place()
		if ok && !seen[p.ID] {
			results = append(results, p)
			seen[p.ID] = true
		}
		if len(results) >= 20 {
			break
		}
	}
	return results, nil
}
