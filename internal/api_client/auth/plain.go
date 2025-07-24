package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"net/http"
)

type plainAuthenticator struct {
	authValue string
}

func NewPlainAuthenticator(authValue string) AuthMethod {
	return &plainAuthenticator{
		authValue: authValue,
	}
}

func (a *plainAuthenticator) AddAuthHeaders(req *http.Request) error {
	req.Header.Set("Authorization", a.authValue)
	return nil
}
