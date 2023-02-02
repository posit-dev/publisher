package util

import "crypto/rand"

// Copyright (C) 2023 by Posit Software, PBC.

func RandomBytes(n int) ([]byte, error) {
	buf := make([]byte, 32)
	_, err := rand.Read(buf)
	return buf, err
}
