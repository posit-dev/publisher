package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
)

// RootRedirect redirects root requests to a specified path
func RootRedirect(rootPath, targetPath string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == rootPath {
			w.Header().Add("Location", targetPath)
			w.WriteHeader(http.StatusTemporaryRedirect)
		} else {
			next(w, req)
		}
	}
}
