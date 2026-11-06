package mapsapi

import (
	"math"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

var patterns = []*regexp.Regexp{
	regexp.MustCompile(`!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)`),
	regexp.MustCompile(`@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)`),
	regexp.MustCompile(`[?&](?:q|query|loc)=loc:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)`),
	regexp.MustCompile(`[?&](?:q|query|ll|center|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)`),
}

func validCoordinates(lat, lng float64) bool {
	return !math.IsNaN(lat) && !math.IsNaN(lng) && !math.IsInf(lat, 0) && !math.IsInf(lng, 0) && math.Abs(lat) <= 90 && math.Abs(lng) <= 180
}

func coordinates(raw string) (float64, float64, bool) {
	if decoded, err := url.QueryUnescape(raw); err == nil {
		raw = decoded
	}
	for _, pattern := range patterns {
		match := pattern.FindStringSubmatch(raw)
		if len(match) != 3 {
			continue
		}
		lat, a := strconv.ParseFloat(match[1], 64)
		lng, b := strconv.ParseFloat(match[2], 64)
		if a == nil && b == nil && validCoordinates(lat, lng) {
			return lat, lng, true
		}
	}
	return 0, 0, false
}

func googleURL(raw string, consent bool) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || strings.ContainsAny(raw, "\r\n") {
		return false
	}
	switch strings.ToLower(u.Hostname()) {
	case "maps.app.goo.gl", "share.google":
		return u.Path != "" && u.Path != "/"
	case "goo.gl":
		return strings.HasPrefix(u.Path, "/maps/")
	case "g.co":
		return strings.HasPrefix(u.Path, "/kgs/") || strings.HasPrefix(u.Path, "/maps/")
	case "maps.google.com":
		return true
	case "google.com", "www.google.com":
		return u.Path == "/maps" || strings.HasPrefix(u.Path, "/maps/")
	case "consent.google.com":
		return consent
	}
	return false
}

func placeName(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || !googleURL(raw, false) {
		return ""
	}
	_, tail, ok := strings.Cut(u.EscapedPath(), "/maps/place/")
	if !ok {
		return ""
	}
	name, err := url.QueryUnescape(strings.SplitN(tail, "/", 2)[0])
	name = strings.TrimSpace(name)
	if err != nil || utf8.RuneCountInString(name) > 240 || strings.ContainsAny(name, "<>") || strings.HasPrefix(name, "@") {
		return ""
	}
	for _, r := range name {
		if unicode.IsControl(r) {
			return ""
		}
	}
	if _, _, ok := coordinates("?q=" + name); ok {
		return ""
	}
	return name
}

func joinUnique(parts ...string) string {
	seen := map[string]bool{}
	values := []string{}
	for _, part := range parts {
		part = strings.TrimSpace(part)
		key := strings.ToLower(part)
		if part != "" && !seen[key] {
			values = append(values, part)
			seen[key] = true
		}
	}
	return strings.Join(values, ", ")
}
