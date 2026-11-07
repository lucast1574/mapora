package mapsapi

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func searchContext(values url.Values) (url.Values, bool) {
	out := url.Values{}
	for _, key := range []string{"city", "district", "state"} {
		v := strings.Join(strings.Fields(values.Get(key)), " ")
		if len(v) > 200 {
			return nil, false
		}
		if v != "" {
			out.Set(key, v)
		}
	}
	return out, true
}

func (s *API) searchPlaces(ctx context.Context, path string, query, values url.Values) ([]Place, error) {
	text := query.Get("q")
	if path == "/structured" {
		text = values.Get("street")
	}
	local := s.streets.search(text, values, query)
	preferLocal := len(local) > 0 && (path == "/structured" || local[0].Match.RequestedHouseNumber != "" || len(streetTokens(local[0].Street)) >= 2)
	if first := strings.Fields(foldStreet(text)); len(first) > 0 {
		for _, kind := range []string{"calle", "ca", "jiron", "jr", "avenida", "av", "avda", "pasaje", "pje", "psje", "carretera", "prolongacion", "prol"} {
			if first[0] == kind {
				preferLocal = len(local) > 0
			}
		}
	}
	providerQuery := url.Values{}
	for k, v := range query {
		providerQuery[k] = append([]string(nil), v...)
	}
	if path == "/api/" {
		hints := []string{text}
		for _, key := range []string{"city", "district", "state"} {
			if v := values.Get(key); v != "" {
				hints = append(hints, v)
			}
		}
		providerQuery.Set("q", strings.Join(hints, ", "))
	}
	job := ctx
	cancel := func() {}
	if len(local) > 0 {
		job, cancel = context.WithTimeout(ctx, 2*time.Second)
	}
	defer cancel()
	remote, err := s.photon(job, path, providerQuery)
	if err != nil && len(local) == 0 {
		return nil, err
	}
	// A confirmed street in our index takes precedence over fuzzy matches to
	// unrelated roads. Preserve a real address result on that street when present.
	exactAddresses := []Place{}
	others := []Place{}
	for _, p := range remote {
		if !locationMatches(p, values) {
			continue
		}
		sameStreet := !preferLocal
		matchingName := false
		for _, street := range local {
			if strings.Join(streetTokens(p.Street), " ") == strings.Join(streetTokens(street.Street), " ") {
				sameStreet = true
				break
			}
			if strings.Join(streetTokens(p.PlaceName), " ") == strings.Join(streetTokens(street.Street), " ") {
				matchingName = true
				sameStreet = true
			}
		}
		if !sameStreet {
			continue
		}
		if len(local) > 0 && p.HouseNumber != "" && local[0].Match.RequestedHouseNumber != "" && foldStreet(p.HouseNumber) != foldStreet(local[0].Match.RequestedHouseNumber) {
			continue
		}
		if preferLocal && (p.HouseNumber != "" || matchingName) {
			exactAddresses = append(exactAddresses, p)
		} else {
			others = append(others, p)
		}
	}
	result := append(exactAddresses, local...)
	if preferLocal {
		result = append(result, others...)
	} else {
		result = append(others, local...)
	}
	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit < 1 {
		limit = 8
	}
	seen := map[string]bool{}
	out := []Place{}
	for _, p := range result {
		if seen[p.ID] {
			continue
		}
		seen[p.ID] = true
		out = append(out, p)
		if len(out) == limit {
			break
		}
	}
	return out, nil
}

func searchAttribution(places []Place) string {
	all := []string{attribution}
	seen := map[string]bool{attribution: true}
	for _, p := range places {
		if p.Attribution != "" && !seen[p.Attribution] {
			all = append(all, p.Attribution)
			seen[p.Attribution] = true
		}
	}
	return strings.Join(all, "; ")
}
