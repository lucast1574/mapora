package mapsapi

import (
	"compress/gzip"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/url"
	"sort"
	"strings"
	"sync"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

//go:embed data/peru-streets.json.gz
var streetFiles embed.FS

// StreetMatch deliberately does not claim that a requested house number exists.
type StreetMatch struct {
	CoordinateType       string `json:"coordinateType"`
	RequestedHouseNumber string `json:"requestedHouseNumber,omitempty"`
	HouseNumberMatched   bool   `json:"houseNumberMatched"`
	SourceURL            string `json:"sourceURL"`
	SourceDate           string `json:"sourceDate"`
}

type streetRecord struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Aliases     []string `json:"aliases,omitempty"`
	City        string   `json:"city"`
	District    string   `json:"district"`
	Province    string   `json:"province"`
	State       string   `json:"state"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
	Attribution string   `json:"attribution"`
	SourceURL   string   `json:"sourceURL"`
	SourceDate  string   `json:"sourceDate"`
}
type indexedStreet struct {
	streetRecord
	names [][]string
}
type streetIndex struct {
	records  []indexedStreet
	tokens   map[string][]int
	prefixes map[string][]int
	cities   map[string]bool
}

var streetOnce sync.Once
var defaultStreets *streetIndex
var streetLoadError error

// ConfigurePeruStreets loads a read-only offline index; requests never download data.
func (s *API) ConfigurePeruStreets() error {
	streetOnce.Do(func() {
		f, err := streetFiles.Open("data/peru-streets.json.gz")
		if err != nil {
			streetLoadError = err
			return
		}
		defer f.Close()
		r, err := gzip.NewReader(f)
		if err != nil {
			streetLoadError = err
			return
		}
		defer r.Close()
		var data struct {
			Version int            `json:"version"`
			Records []streetRecord `json:"records"`
		}
		if err = json.NewDecoder(io.LimitReader(r, 128<<20)).Decode(&data); err != nil {
			streetLoadError = err
			return
		}
		if data.Version != 1 || len(data.Records) == 0 {
			streetLoadError = errors.New("invalid Peru street index")
			return
		}
		defaultStreets, streetLoadError = newStreetIndex(data.Records)
	})
	s.streets = defaultStreets
	return streetLoadError
}

func foldStreet(text string) string {
	var b strings.Builder
	for _, r := range norm.NFD.String(strings.ToLower(text)) {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteByte(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

var streetWords = map[string]bool{"av": true, "avda": true, "avenida": true, "jr": true, "jiron": true, "ca": true, "calle": true, "psje": true, "pje": true, "pasaje": true, "prol": true, "prolongacion": true, "carretera": true, "autopista": true, "de": true, "del": true, "la": true, "las": true, "los": true, "el": true}

func streetTokens(text string) []string {
	out := []string{}
	for _, t := range strings.Fields(foldStreet(text)) {
		if !streetWords[t] {
			out = append(out, t)
		}
	}
	return out
}
func newStreetIndex(records []streetRecord) (*streetIndex, error) {
	idx := &streetIndex{tokens: map[string][]int{}, prefixes: map[string][]int{}, cities: map[string]bool{}}
	for _, r := range records {
		if r.ID == "" || r.Name == "" || r.SourceURL == "" || r.Attribution == "" || !validCoordinates(r.Latitude, r.Longitude) || r.Latitude < -19 || r.Latitude > 1 || r.Longitude < -82 || r.Longitude > -68 {
			return nil, errors.New("invalid Peru street record")
		}
		item := indexedStreet{streetRecord: r}
		seen := map[string]bool{}
		prefixSeen := map[string]bool{}
		id := len(idx.records)
		for _, name := range append([]string{r.Name}, r.Aliases...) {
			ts := streetTokens(name)
			if len(ts) > 0 {
				item.names = append(item.names, ts)
			}
			for _, t := range ts {
				if !seen[t] {
					idx.tokens[t] = append(idx.tokens[t], id)
					seen[t] = true
				}
				// Byte prefixes are safe for lookup: the final comparison uses whole tokens.
				for end := 2; end <= len(t) && end <= 24; end++ {
					p := t[:end]
					if !prefixSeen[p] {
						idx.prefixes[p] = append(idx.prefixes[p], id)
						prefixSeen[p] = true
					}
				}
			}
		}
		for _, name := range []string{r.City, r.District, r.Province} {
			if n := foldStreet(name); n != "" {
				idx.cities[n] = true
			}
		}
		idx.records = append(idx.records, item)
	}
	return idx, nil
}
func allowedPeru(q url.Values) bool {
	countries := q["countrycode"]
	if len(countries) == 0 {
		return true
	}
	for _, c := range countries {
		if c == "PE" {
			return true
		}
	}
	return false
}
func locationMatches(p Place, values url.Values) bool {
	for _, filter := range []struct {
		key    string
		fields []string
	}{{"city", []string{p.City, p.District, p.County}}, {"district", []string{p.District}}, {"state", []string{p.State}}, {"county", []string{p.County}}} {
		want := foldAdmin(values.Get(filter.key))
		if want == "" {
			continue
		}
		found := false
		for _, field := range filter.fields {
			if foldAdmin(field) == want {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func foldAdmin(value string) string {
	value = foldStreet(value)
	for _, prefix := range []string{"provincia de ", "distrito de ", "departamento de ", "region de ", "region "} {
		value = strings.TrimPrefix(value, prefix)
	}
	return value
}
func containsTokens(name, want []string, prefix bool) bool {
	for i, t := range want {
		found := false
		for _, n := range name {
			if n == t || (prefix && i == len(want)-1 && len(t) >= 2 && strings.HasPrefix(n, t)) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
func houseSuffix(t string) bool {
	if len(t) < 2 || len(t) > 6 {
		return false
	}
	for _, r := range t {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
func (idx *streetIndex) search(text string, values, query url.Values) []Place {
	if idx == nil || !allowedPeru(query) || values.Get("postcode") != "" {
		return nil
	}
	scoped := url.Values{}
	for _, k := range []string{"city", "district", "state", "county"} {
		scoped.Set(k, values.Get(k))
	}
	clean := foldStreet(text)
	// Do not interpret a real street name such as Jirón Puno or José Olaya
	// as an implicit city suffix. An exact full-name candidate wins first.
	if len(query["countrycode"]) > 0 || scoped.Get("city") != "" || scoped.Get("district") != "" || scoped.Get("state") != "" || query.Get("lat") != "" || query.Get("bbox") != "" {
		if hits := idx.candidates(streetTokens(clean), scoped, query, values.Get("housenumber")); len(hits) > 0 {
			return hits
		}
	}
	if strings.HasSuffix(clean, " peru") && len(streetTokens(clean)) > 1 {
		clean = strings.TrimSuffix(clean, " peru")
	}
	// A typed city suffix is a context hint, not a word to match in street names.
	if scoped.Get("city") == "" {
		parts := strings.Fields(clean)
		for cut := 1; cut < len(parts); cut++ {
			city := strings.Join(parts[cut:], " ")
			if idx.cities[city] && len(streetTokens(strings.Join(parts[:cut], " "))) >= 2 {
				scoped.Set("city", city)
				clean = strings.Join(parts[:cut], " ")
				break
			}
		}
	} else if city := foldStreet(scoped.Get("city")); strings.HasSuffix(clean, " "+city) {
		clean = strings.TrimSuffix(clean, " "+city)
	}
	// Keep unconstrained worldwide place search unchanged. The supplementary
	// street index is selected by country, local context or a geographic hint.
	if len(query["countrycode"]) == 0 && scoped.Get("city") == "" && scoped.Get("district") == "" && scoped.Get("state") == "" && query.Get("lat") == "" && query.Get("bbox") == "" {
		return nil
	}
	ts := streetTokens(clean)
	if len(ts) == 0 {
		return nil
	}
	requested := values.Get("housenumber")
	// First keep numeric street names intact (Calle 28 de Julio, Pasaje 101).
	hits := idx.candidates(ts, scoped, query, requested)
	if len(hits) > 0 {
		return hits
	}
	if requested == "" && len(ts) >= 2 && houseSuffix(ts[len(ts)-1]) {
		requested = ts[len(ts)-1]
		ts = ts[:len(ts)-1]
		if len(ts) > 0 {
			switch ts[len(ts)-1] {
			case "n", "no", "nº", "nro", "numero", "num":
				ts = ts[:len(ts)-1]
			}
		}
		if len(ts) == 0 {
			return nil
		}
		return idx.candidates(ts, scoped, query, requested)
	}
	return nil
}
func (idx *streetIndex) candidates(ts []string, values, query url.Values, number string) []Place {
	var candidates []int
	for i, t := range ts {
		ids := idx.tokens[t]
		if i == len(ts)-1 {
			ids = idx.prefixes[t]
			if len(t) == 1 {
				ids = idx.tokens[t]
			}
		}
		if len(ids) == 0 {
			return nil
		}
		if candidates == nil || len(ids) < len(candidates) {
			candidates = ids
		}
	}
	lat, lng, hasBias := 0.0, 0.0, false
	if query.Get("lat") != "" {
		var err error
		lat, lng, err = coordinateQuery(query)
		hasBias = err == nil
	}
	var bounds [4]float64
	hasBounds := false
	if raw := query.Get("bbox"); raw != "" {
		_, err := fmt.Sscanf(raw, "%f,%f,%f,%f", &bounds[0], &bounds[1], &bounds[2], &bounds[3])
		hasBounds = err == nil
	}
	type match struct {
		record   int
		distance float64
		exact    bool
	}
	found := []match{}
	for _, id := range candidates {
		r := idx.records[id]
		if !locationMatches(Place{City: r.City, District: r.District, County: r.Province, State: r.State}, values) {
			continue
		}
		matches, exact := false, false
		for _, name := range r.names {
			if containsTokens(name, ts, true) {
				matches = true
				if len(name) == len(ts) && containsTokens(name, ts, false) {
					exact = true
				}
			}
		}
		if !matches {
			continue
		}
		if hasBounds && (r.Longitude < bounds[0] || r.Longitude > bounds[2] || r.Latitude < bounds[1] || r.Latitude > bounds[3]) {
			continue
		}
		d := 0.0
		if hasBias {
			d = distanceMeters(lat, lng, r.Latitude, r.Longitude)
		}
		found = append(found, match{id, d, exact})
	}
	sort.SliceStable(found, func(i, j int) bool {
		if found[i].exact != found[j].exact {
			return found[i].exact
		}
		if math.Abs(found[i].distance-found[j].distance) > 1 {
			return found[i].distance < found[j].distance
		}
		return idx.records[found[i].record].ID < idx.records[found[j].record].ID
	})
	out := []Place{}
	seen := map[string]bool{}
	for _, m := range found {
		r := idx.records[m.record]
		key := foldStreet(r.Name) + "|" + foldStreet(r.District) + "|" + foldStreet(r.Province)
		if seen[key] {
			continue
		}
		seen[key] = true
		p := Place{ID: r.ID, PlaceName: r.Name, Street: r.Name, City: r.City, District: r.District, County: r.Province, State: r.State, Country: "Perú", CountryCode: "PE", Latitude: r.Latitude, Longitude: r.Longitude, Source: "mapora_streets", Attribution: r.Attribution, GoogleMapsLink: fmt.Sprintf("https://www.google.com/maps?q=%.6f,%.6f", r.Latitude, r.Longitude), Match: &StreetMatch{CoordinateType: "street_reference", RequestedHouseNumber: number, HouseNumberMatched: false, SourceURL: r.SourceURL, SourceDate: r.SourceDate}}
		p.StreetAddress = joinUnique(r.Name, r.District, r.Province, r.State, "Perú")
		p.Address = p.StreetAddress
		p.Quality = quality(p, "street")
		out = append(out, p)
		if len(out) == 20 {
			break
		}
	}
	return out
}
