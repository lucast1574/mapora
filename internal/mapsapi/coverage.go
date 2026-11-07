package mapsapi

import (
	"errors"
	"math"
	"net/http"
	"strings"
)

type Point struct {
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

func (p Point) Valid() bool {
	return p.Latitude != nil && p.Longitude != nil && validCoordinates(*p.Latitude, *p.Longitude)
}

type Polygon struct {
	Type        string        `json:"type"`
	Coordinates [][][]float64 `json:"coordinates"`
}
type Zone struct {
	ID       string  `json:"id,omitempty"`
	Name     string  `json:"name"`
	Geometry Polygon `json:"geometry"`
	FeeCents int64   `json:"feeCents"`
	Currency string  `json:"currency"`
}

func cross(a, b, p []float64) float64 { return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]) }
func onSegment(a, b, p []float64) bool {
	return math.Abs(cross(a, b, p)) < 1e-10 && p[0] >= math.Min(a[0], b[0])-1e-10 && p[0] <= math.Max(a[0], b[0])+1e-10 && p[1] >= math.Min(a[1], b[1])-1e-10 && p[1] <= math.Max(a[1], b[1])+1e-10
}
func intersects(a, b, c, d []float64) bool {
	return cross(a, b, c)*cross(a, b, d) < 0 && cross(c, d, a)*cross(c, d, b) < 0 || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)
}

// Boundary points are covered on the exterior ring; hole boundaries are excluded.
func insideRing(p []float64, ring [][]float64) bool {
	inside := false
	for i := 0; i < len(ring)-1; i++ {
		a, b := ring[i], ring[i+1]
		if onSegment(a, b, p) {
			return true
		}
		if (a[1] > p[1]) != (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0] {
			inside = !inside
		}
	}
	return inside
}
func (z *Zone) Validate() error {
	z.Name = strings.TrimSpace(z.Name)
	z.Currency = strings.ToUpper(strings.TrimSpace(z.Currency))
	if len(z.Name) < 2 || len(z.Name) > 120 || len(z.ID) > 80 || z.FeeCents < 0 || z.FeeCents > 100000000 || len(z.Currency) != 3 {
		return errors.New("Nombre de 2–120 bytes, tarifa no negativa en centavos y moneda ISO de tres letras obligatorios.")
	}
	for _, c := range z.Currency {
		if c < 'A' || c > 'Z' {
			return errors.New("Moneda inválida.")
		}
	}
	if z.Geometry.Type != "Polygon" || len(z.Geometry.Coordinates) < 1 || len(z.Geometry.Coordinates) > 5 {
		return errors.New("Usa un Polygon GeoJSON con un anillo exterior y hasta cuatro huecos.")
	}
	total := 0
	for ri, ring := range z.Geometry.Coordinates {
		total += len(ring)
		if len(ring) < 4 || total > 200 {
			return errors.New("Polígono de 4–200 vértices, incluido el cierre.")
		}
		minX, maxX := 180.0, -180.0
		area := 0.0
		for i, p := range ring {
			if len(p) != 2 || !validCoordinates(p[1], p[0]) {
				return errors.New("Las coordenadas GeoJSON son [longitud, latitud].")
			}
			minX = math.Min(minX, p[0])
			maxX = math.Max(maxX, p[0])
			if i > 0 {
				area += ring[i-1][0]*p[1] - p[0]*ring[i-1][1]
			}
		}
		if ring[0][0] != ring[len(ring)-1][0] || ring[0][1] != ring[len(ring)-1][1] || math.Abs(area) < 1e-12 || maxX-minX > 180 {
			return errors.New("Cierra el anillo y evita polígonos degenerados o que crucen el antimeridiano.")
		}
		for i := 0; i < len(ring)-1; i++ {
			for j := i + 2; j < len(ring)-1; j++ {
				if i == 0 && j == len(ring)-2 {
					continue
				}
				if intersects(ring[i], ring[i+1], ring[j], ring[j+1]) {
					return errors.New("El polígono no puede cruzarse consigo mismo.")
				}
			}
		}
		if ri > 0 {
			outer := z.Geometry.Coordinates[0]
			for _, p := range ring {
				if !insideRing(p, outer) {
					return errors.New("Los huecos deben estar dentro del anillo exterior.")
				}
			}
			for prior := 0; prior < ri; prior++ {
				other := z.Geometry.Coordinates[prior]
				for i := 0; i < len(ring)-1; i++ {
					for j := 0; j < len(other)-1; j++ {
						if intersects(ring[i], ring[i+1], other[j], other[j+1]) {
							return errors.New("Los anillos no pueden tocarse ni cruzarse.")
						}
					}
				}
				if prior > 0 && (insideRing(ring[0], other) || insideRing(other[0], ring)) {
					return errors.New("Los huecos no pueden superponerse.")
				}
			}
		}
	}
	return nil
}
func (z Zone) Contains(p Point) bool {
	xy := []float64{*p.Longitude, *p.Latitude}
	if !insideRing(xy, z.Geometry.Coordinates[0]) {
		return false
	}
	for _, ring := range z.Geometry.Coordinates[1:] {
		if insideRing(xy, ring) {
			return false
		}
	}
	return true
}
func Coverage(p Point, zones []Zone) map[string]any {
	matches := []Zone{}
	for _, z := range zones {
		if z.Contains(p) {
			matches = append(matches, z)
		}
	}
	// Overlaps are returned explicitly; the caller chooses its commercial policy.
	return map[string]any{"covered": len(matches) > 0, "matches": matches, "point": p, "feePolicy": "all_matching_zones"}
}
func coverageHTTP(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Point Point  `json:"point"`
		Zones []Zone `json:"zones"`
	}
	if !decodeInput(w, r, &in, 256<<10) {
		return
	}
	if !in.Point.Valid() || len(in.Zones) < 1 || len(in.Zones) > 20 {
		fail(w, 400, "invalid_coverage", "Indica point válido y de 1 a 20 zonas.")
		return
	}
	for i := range in.Zones {
		if err := in.Zones[i].Validate(); err != nil {
			fail(w, 400, "invalid_zone", err.Error())
			return
		}
	}
	writeJSON(w, 200, Coverage(in.Point, in.Zones))
}
