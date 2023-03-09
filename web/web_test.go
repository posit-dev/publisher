package web

import (
	"testing"
)

func TestDistExists(t *testing.T) {
	// checks if the go:embed directive exists
	_, err := Dist.ReadDir(".")
	if err != nil {
		t.Fail()
	}
}
