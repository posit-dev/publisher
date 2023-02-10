package auth

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/http"
)

type apiKeyAuthenticator struct {
	apiKey     string
	headerName string
}

// NewApiKeyAuthenticator creates an AuthMethod that
// adds an Authorization header containing the provided API key.
// If headerName is non-empty, it will be used instead of "Authorization".
// Connect accepts both "Authorization" and "X-Rsc-Authorization"
// to support certain proxy configurations upstream of Connect.
func NewApiKeyAuthenticator(apiKey, headerName string) AuthMethod {
	if headerName == "" {
		headerName = "Authorization"
	}
	return &apiKeyAuthenticator{
		apiKey:     apiKey,
		headerName: headerName,
	}
}

func (a *apiKeyAuthenticator) AddAuthHeaders(req *http.Request) error {
	header := fmt.Sprintf("Key %s", a.apiKey)
	req.Header.Set(a.headerName, header)
	return nil
}
