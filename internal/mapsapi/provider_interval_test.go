package mapsapi

import (
	"testing"
	"time"
)

func TestProviderIntervalMustBeExplicitAndBounded(t *testing.T) {
	for _, interval := range []time.Duration{0, -time.Second, 6 * time.Second} {
		if _, err := NewWithInterval("https://provider.example", interval); err == nil {
			t.Fatal("invalid interval accepted", interval)
		}
	}
	for _, interval := range []time.Duration{50 * time.Millisecond, 500 * time.Millisecond} {
		api, err := NewWithInterval("http://mapora-photon_photon:2322", interval)
		if err != nil {
			t.Fatal(err)
		}
		api.providerPace.Stop()
	}
}
