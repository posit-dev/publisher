package auth

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
