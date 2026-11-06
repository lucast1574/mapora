package web

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"image/png"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func TestSocialImagesAndIconsHaveExpectedDimensions(t *testing.T) {
	h := Handler()
	for _, asset := range []struct {
		path          string
		width, height int
	}{{"/og-mapora.png", 1200, 630}, {"/favicon-96.png", 96, 96}, {"/apple-touch-icon.png", 180, 180}, {"/icon-512.png", 512, 512}} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", asset.path, nil))
		size, err := png.DecodeConfig(bytes.NewReader(w.Body.Bytes()))
		if w.Code != 200 || err != nil || size.Width != asset.width || size.Height != asset.height {
			t.Fatal("social asset", asset.path, w.Code, size, err)
		}
	}
}

func TestPublicPagesContainHTMLAndUniqueMetadata(t *testing.T) {
	h := Handler()
	titles := map[string]bool{}
	for _, path := range []string{"/", "/documentacion", "/api-busqueda-direcciones", "/resolver-enlaces-google-maps", "/geocodificacion-inversa", "/mapas-interactivos", "/legal"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "https://mapora.nexode.app"+path, nil))
		body := w.Body.String()
		if w.Code != 200 || strings.Count(body, "<h1") != 1 || !strings.Contains(body, `data-prerendered="true"`) || len(body) < 5000 {
			t.Fatalf("%s: missing complete HTML (%d, %d bytes)", path, w.Code, len(body))
		}
		if !strings.Contains(body, `rel="canonical" href="https://mapora.nexode.app`+path+`"`) || !strings.Contains(body, `content="index,follow,max-image-preview:large"`) {
			t.Fatal("invalid canonical/indexability", path)
		}
		title := regexp.MustCompile(`<title>([^<]+)</title>`).FindString(body)
		if title == "" || titles[title] {
			t.Fatal("missing or duplicate title", path)
		}
		titles[title] = true
		match := regexp.MustCompile(`<script type="application/ld\+json">(.*?)</script>`).FindStringSubmatch(body)
		var schema map[string]any
		if len(match) != 2 || json.Unmarshal([]byte(match[1]), &schema) != nil || schema["@context"] != "https://schema.org" {
			t.Fatal("invalid structured data", path)
		}
		for _, tag := range []string{`property="og:image"`, `name="twitter:card"`, `name="description"`} {
			if !strings.Contains(body, tag) {
				t.Fatal("missing metadata", path, tag)
			}
		}
	}
}
func TestPrivatePagesNoindexWithoutMarketingCanonical(t *testing.T) {
	h := Handler()
	for _, path := range []string{"/app", "/app/keys", "/app/maps", "/login", "/signup", "/forgot", "/reset?token=private", "/map/mv_test"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "https://app-mapora.nexode.app"+path, nil))
		body := w.Body.String()
		if w.Code != 200 || !strings.Contains(w.Header().Get("X-Robots-Tag"), "noindex") || !strings.Contains(body, `content="noindex,nofollow"`) || strings.Contains(body, `rel="canonical"`) || strings.Contains(body, `data-prerendered="true"`) {
			t.Fatal("private route became a marketing page", path, w.Code)
		}
	}
}
func TestMissingRoutesReturn404(t *testing.T) {
	h := Handler()
	for _, path := range []string{"/no-existe", "/missing-asset.jpg", "/assets/missing.js", "/shell.html", "/routes.json"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 404 || !strings.Contains(w.Header().Get("X-Robots-Tag"), "noindex") {
			t.Fatal("soft 404", path, w.Code)
		}
	}
}
func TestCanonicalHostAndRouteRedirects(t *testing.T) {
	h := Handler()
	for _, test := range []struct {
		url, target string
		code        int
	}{
		{"https://maps-api.nexode.app/", "https://mapora.nexode.app/", 308},
		{"https://app-mapora.nexode.app/documentacion", "https://mapora.nexode.app/documentacion", 308},
		{"https://app-mapora.nexode.app/", "/app", 307},
		{"https://mapora.nexode.app/documentacion/", "/documentacion", 308},
		{"https://mapora.nexode.app/index.html", "/", 308},
		{"https://mapora.nexode.app/mapas-interactivos/index.html", "/mapas-interactivos", 308},
	} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", test.url, nil))
		if w.Code != test.code || w.Header().Get("Location") != test.target {
			t.Fatal("canonical routing", test.url, w.Code, w.Header().Get("Location"))
		}
	}
}
func TestSitemapContainsOnlyIndexablePublicPages(t *testing.T) {
	h := Handler()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "https://mapora.nexode.app/sitemap.xml", nil))
	var sitemap struct {
		URLs []struct {
			Location string `xml:"loc"`
		} `xml:"url"`
	}
	if w.Code != 200 || xml.Unmarshal(w.Body.Bytes(), &sitemap) != nil || len(sitemap.URLs) != 7 {
		t.Fatal("sitemap", w.Code, w.Body.String())
	}
	for _, u := range sitemap.URLs {
		r := httptest.NewRecorder()
		h.ServeHTTP(r, httptest.NewRequest("GET", u.Location, nil))
		if r.Code != 200 || strings.Contains(r.Header().Get("X-Robots-Tag"), "noindex") {
			t.Fatal("non-indexable sitemap URL", u.Location)
		}
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/robots.txt", nil))
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Sitemap: https://mapora.nexode.app/sitemap.xml") {
		t.Fatal("robots", w.Code)
	}
}
func TestVerificationEscapingAndHeadRequests(t *testing.T) {
	t.Setenv("GOOGLE_SITE_VERIFICATION", `test"<value`)
	h := Handler()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if !strings.Contains(w.Body.String(), `name="google-site-verification" content="test&#34;&lt;value"`) {
		t.Fatal("unsafe or missing verification metadata")
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("HEAD", "/", nil))
	if w.Code != 200 || w.Body.Len() != 0 {
		t.Fatal("HEAD returned body")
	}
}
