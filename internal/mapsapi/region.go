package mapsapi

import (
	"net/url"
	"strings"
)

// Coverage policy also applies while offline index compaction is in progress.
var americasCountries = strings.Fields("AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GS GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI FR DK NL GB")

func (s *API) RestrictToAmericas() { s.regional = true }
func americasPlace(p Place) bool {
	code := strings.ToUpper(p.CountryCode)
	in := func(w, s, e, n float64) bool {
		return p.Longitude >= w && p.Longitude <= e && p.Latitude >= s && p.Latitude <= n
	}
	switch code {
	case "FR":
		return in(-62, 1, -48, 19) || in(-57, 46, -55, 48)
	case "DK":
		return in(-75, 58, -10, 85)
	case "NL":
		return in(-71, 10, -62, 19)
	case "GB":
		return in(-83, 15, -59, 33) || in(-62, -59, -25, -50)
	}
	for _, c := range americasCountries {
		if code == c {
			return in(-180, -60, -20, 85) || in(170, 45, 180, 75) || in(-75, 58, -10, 85)
		}
	}
	return false
}
func americasQuery(q url.Values) url.Values {
	clone := url.Values{}
	for k, v := range q {
		clone[k] = append([]string(nil), v...)
	}
	if len(clone["countrycode"]) == 0 {
		clone["countrycode"] = append([]string(nil), americasCountries...)
	}
	return clone
}
