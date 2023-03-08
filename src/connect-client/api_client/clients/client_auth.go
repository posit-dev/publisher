package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/api_client/auth"
	"net/http"
)

type AuthenticatedTransport struct {
	base http.RoundTripper
	auth auth.AuthMethod
}

func NewAuthenticatedTransport(base http.RoundTripper, auth auth.AuthMethod) http.RoundTripper {
	return &AuthenticatedTransport{
		base: base,
		auth: auth,
	}
}

// RoundTrip authenticates the request before sending it.
func (t *AuthenticatedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	reqBodyClosed := false
	if req.Body != nil {
		defer func() {
			if !reqBodyClosed {
				req.Body.Close()
			}
		}()
	}

	if t.auth != nil {
		// RoundTrippers are not permitted to modify the request.
		req = cloneRequest(req)
		t.auth.AddAuthHeaders(req)
	}
	// Base.RoundTripper will close the request body
	reqBodyClosed = true
	return t.base.RoundTrip(req)
}

func cloneRequest(req *http.Request) *http.Request {
	cloned := *req
	cloned.Header = make(http.Header, len(req.Header))
	for key, values := range req.Header {
		cloned.Header[key] = append([]string(nil), values...)
	}
	return &cloned
}
