package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
)

// AddPathPrefix adds a path prefix to the inbound request.
// We use this to serve UI files from the "static/"
// subdirectory on the root URL path.
func AddPathPrefix(prefix string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		req.URL.Path = prefix + req.URL.Path
		req.URL.RawPath = prefix + req.URL.RawPath
		next(w, req)
	}
}
