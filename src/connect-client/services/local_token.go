package services

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/base64"
	"strings"

	"connect-client/util"
)

type LocalToken string

func NewLocalToken() (LocalToken, error) {
	key, err := util.RandomBytes(32)
	if err != nil {
		return LocalToken(""), err
	}
	tokenString, err := toBase64(key)
	if err != nil {
		return LocalToken(""), err
	}
	return LocalToken(tokenString), nil
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
