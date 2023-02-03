package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"time"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type statusCapturingResponseWriter struct {
	writer http.ResponseWriter
	sent   int64
	status int
}

func NewStatusCapturingResponseWriter(w http.ResponseWriter) *statusCapturingResponseWriter {
	return &statusCapturingResponseWriter{
		writer: w,
	}
}

func (w *statusCapturingResponseWriter) Header() http.Header {
	return w.writer.Header()
}

func (w *statusCapturingResponseWriter) Write(buf []byte) (int, error) {
	w.sent += int64(len(buf))
	return w.writer.Write(buf)
}

func (w *statusCapturingResponseWriter) WriteHeader(status int) {
	w.status = status
	w.writer.WriteHeader(status)
}

func (w *statusCapturingResponseWriter) GetStatus() int {
	return w.status
}

func (w *statusCapturingResponseWriter) GetBytesSent() int64 {
	return w.sent
}

// LogRequest logs request info to the specified logger.
func LogRequest(msg string, logger rslog.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		startTime := time.Now()
		writer := NewStatusCapturingResponseWriter(w)
		next(writer, req)
		elapsedMs := time.Now().Sub(startTime).Milliseconds()

		logger.WithFields(rslog.Fields{
			"method":      req.Method,
			"url":         req.URL.String(),
			"elapsed_ms":  elapsedMs,
			"status":      writer.GetStatus(),
			"req_size":    req.ContentLength,
			"resp_size":   writer.GetBytesSent(),
			"client_addr": req.RemoteAddr,
		}).Infof("%s", msg)
	}
}
