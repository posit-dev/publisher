package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import "net/http"

type redirectWriter struct {
	writer   http.ResponseWriter
	location string
}

func newRedirectWriter(w http.ResponseWriter, loc string) *redirectWriter {
	return &redirectWriter{
		writer:   w,
		location: loc,
	}
}

func (w *redirectWriter) Header() http.Header {
	return w.writer.Header()
}

func (w *redirectWriter) Write(data []byte) (int, error) {
	return w.writer.Write(data)
}

func (w *redirectWriter) WriteHeader(statusCode int) {
	if statusCode == http.StatusNotFound {
		w.writer.Header()["Location"] = []string{w.location}
		w.writer.WriteHeader(http.StatusMovedPermanently)
	} else {
		w.writer.WriteHeader(statusCode)
	}
}

func RedirectOn404(h http.Handler, location string) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		w = newRedirectWriter(w, location)
		h.ServeHTTP(w, req)
	}
}
