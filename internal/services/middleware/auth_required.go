package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"net/http"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// AuthRequired verifies that the session has been
// marked as authenticated by one of the auth middlewares.
type authenticatedContextKeyType string

const authenticatedContextKey authenticatedContextKeyType = "authenticated"

func AuthRequired(logger rslog.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if !isRequestAuthenticated(req) {
			w.WriteHeader(http.StatusUnauthorized)
		} else {
			next(w, req)
		}
	}
}

func authenticatedRequest(req *http.Request) *http.Request {
	ctx := context.WithValue(req.Context(), authenticatedContextKey, true)
	return req.WithContext(ctx)
}

func isRequestAuthenticated(req *http.Request) bool {
	return req.Context().Value(authenticatedContextKey) == true
}
