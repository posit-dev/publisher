package auth

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
)

type nullAuthenticator struct{}

func NewNullAuthenticator() AuthMethod {
	return &nullAuthenticator{}
}

func (a *nullAuthenticator) AddAuthHeaders(req *http.Request) error {
	return nil
}
