package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"net/http"

	"github.com/rstudio/connect-client/internal/services"
)

// LocalToken looks for a `token` query parameter. If
// present, it matches it against the (single) token
// generated at startup and included in the URL we
// present to the user. If it matches, redirect to the
// original URL without the token parameter and with a valid
// session cookie. A mismatch is an auth failure (401).
const tokenParameterName string = "token"

func LocalTokenSession(expectedToken services.LocalToken, logger *slog.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		target := req.URL
		receivedTokens, ok := target.Query()[tokenParameterName]
		if ok {
			receivedToken := receivedTokens[0]
			if expectedToken == services.LocalToken(receivedToken) {
				// Success
				logger.Info("Authenticated via token, creating session")
				setCookie(w)
				values := target.Query()
				values.Del(tokenParameterName)
				target.RawQuery = values.Encode()
				w.Header().Add("Location", target.String())
				w.WriteHeader(http.StatusMovedPermanently)
			} else {
				// Failure
				logger.Error("Invalid authentication token", "token", receivedToken)
				w.WriteHeader(http.StatusUnauthorized)
			}
		} else {
			// No token in the request
			next(w, req)
		}
	}
}
