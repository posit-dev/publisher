package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
)

func RandomBytes(n int) ([]byte, error) {
	buf := make([]byte, n)
	_, err := rand.Read(buf)
	return buf, err
}

func RandomString(n int) (string, error) {
	// Base64 encoding of bytes->string expands length by 1/3
	key, err := RandomBytes((n * 3) / 4)
	if err != nil {
		return "", err
	}
	tokenString, err := toBase64(key)
	if err != nil {
		return "", err
	}
	return tokenString, nil
}

func toBase64(data []byte) (string, error) {
	var writer strings.Builder
	encoder := base64.NewEncoder(base64.RawURLEncoding, &writer)
	_, err := encoder.Write(data)
	if err != nil {
		return "", err
	}
	return writer.String(), nil
}
