package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/services"
	"net/http"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// LocalToken looks for a `token` query parameter. If
// present, it matches it against the (single) token
// generated at startup and included in the URL we
// present to the user. If it matches, redirect to the
// original URL without the token parameter and with a valid
// session cookie. A mismatch is an auth failure (401).
const tokenParameterName string = "token"

func LocalTokenSession(expectedToken services.LocalToken, logger rslog.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		target := req.URL
		receivedToken := target.Query().Get(tokenParameterName)
		if receivedToken != "" {
			if expectedToken == services.LocalToken(receivedToken) {
				// Success
				logger.Infof("Authenticated via token, creating session")
				req = authenticatedRequest(req)
				setCookie(w)
				values := target.Query()
				values.Del(tokenParameterName)
				target.RawQuery = values.Encode()
				w.Header().Add("Location", target.String())
				w.WriteHeader(http.StatusMovedPermanently)
			} else {
				// Failure
				logger.Errorf("Invalid authentication token: '%s'", receivedToken)
				w.WriteHeader(http.StatusUnauthorized)
			}
		} else {
			// No token in the request
			next(w, req)
		}
	}
}
