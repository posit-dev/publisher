package services

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
)

type LocalToken string

func NewToken() (LocalToken, error) {
	key, err := randomBytes(32)
	if err != nil {
		return LocalToken(""), err
	}
	tokenString, err := toBase64(key)
	if err != nil {
		return LocalToken(""), err
	}
	return LocalToken(tokenString), nil
}

func randomBytes(n int) ([]byte, error) {
	buf := make([]byte, 32)
	_, err := rand.Read(buf)
	return buf, err
}

func toBase64(data []byte) (string, error) {
	var writer strings.Builder
	encoder := base64.NewEncoder(base64.RawStdEncoding, &writer)
	_, err := encoder.Write(data)
	if err != nil {
		return "", err
	}
	return writer.String(), nil
}
