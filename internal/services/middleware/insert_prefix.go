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
		p := prefix + r.URL.Path
		rp := prefix + r.URL.RawPath
		if len(p) > len(r.URL.Path) && (r.URL.RawPath == "" || len(rp) > len(r.URL.RawPath)) {
			r2 := new(http.Request)
			*r2 = *r
			r2.URL = new(url.URL)
			*r2.URL = *r.URL
			r2.URL.Path = p
			r2.URL.RawPath = rp
			h.ServeHTTP(w, r2)
		} else {
			http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		}
	})
}
