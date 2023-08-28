package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/url"
)

// A modified version of http.StripPrefix
func InsertPrefix(h http.Handler, prefix string) http.Handler {
	if prefix == "" {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r2 := new(http.Request)
		*r2 = *r
		r2.URL = new(url.URL)
		*r2.URL = *r.URL
		r2.URL.Path = prefix + r.URL.Path
		r2.URL.RawPath = prefix + r.URL.RawPath
		h.ServeHTTP(w, r2)
	})
}
