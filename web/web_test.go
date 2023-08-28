package web

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"
)

func TestDistExists(t *testing.T) {
	// checks if the go:embed directive exists
	_, err := dist.ReadDir(".")
	if err != nil {
		t.Fail()
	}
}
