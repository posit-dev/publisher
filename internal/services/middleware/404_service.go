package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import "net/http"

type notFoundWriter struct {
	writer     http.ResponseWriter
	header     http.Header
	StatusCode int
}

func newNotFoundWriter(w http.ResponseWriter) *notFoundWriter {
	return &notFoundWriter{
		writer: w,
		header: http.Header{},
	}
}

func (w *notFoundWriter) Header() http.Header {
	// Capture the header sent by the underlying handler,
	// and decide later whether to send it.
	return w.header
}

func (w *notFoundWriter) Write(data []byte) (int, error) {
	if w.StatusCode != http.StatusNotFound {
		// We have a valid response, send it.
		return w.writer.Write(data)
	} else {
		// Eat this response and we'll serve up a better one
		return len(data), nil
	}
}

func (w *notFoundWriter) WriteHeader(statusCode int) {
	w.StatusCode = statusCode
	if statusCode != http.StatusNotFound {
		// Valid response from the underlying handler.
		// Respond with the headers that handler provided.
		realHeader := w.writer.Header()
		for k, v := range w.header {
			realHeader[k] = v
		}
		w.writer.WriteHeader(statusCode)
	}
}

func ServeIndexOn404(h http.Handler, location string) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		writer := newNotFoundWriter(w)
		h.ServeHTTP(writer, req)

		if writer.StatusCode == http.StatusNotFound {
			// Serve the index.html page and let the frontend handle routing
			req.URL.Path = "/"
			req.URL.RawPath = "/"
			h.ServeHTTP(w, req)
		}
	}
}
