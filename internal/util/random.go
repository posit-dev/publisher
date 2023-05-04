package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"crypto/rand"
)

func RandomBytes(n int) ([]byte, error) {
	buf := make([]byte, n)
	_, err := rand.Read(buf)
	return buf, err
}
