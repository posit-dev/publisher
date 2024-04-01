package middleware

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rstudio/connect-client/internal/logging"
)

type statusCapturingResponseWriter struct {
	writer    http.ResponseWriter
	bytesSent int64
	status    int
}

func NewStatusCapturingResponseWriter(w http.ResponseWriter) *statusCapturingResponseWriter {
	return &statusCapturingResponseWriter{
		writer: w,
		status: http.StatusOK,
	}
}

func (w *statusCapturingResponseWriter) Header() http.Header {
	return w.writer.Header()
}

func (w *statusCapturingResponseWriter) Write(buf []byte) (int, error) {
	w.bytesSent += int64(len(buf))
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
	return w.bytesSent
}

func (w *statusCapturingResponseWriter) Flush() {
	// sse.Server.ServeHTTP requires that the writer also implement http.Flusher
	w.writer.(http.Flusher).Flush()
}

func getBodyParams(req *http.Request) map[string]string {
	contentType := req.Header.Get("Content-Type")
	if contentType != "application/json" {
		return nil
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil
	}
	req.Body = io.NopCloser(bytes.NewReader(body))

	jsonData := map[string]any{}
	err = json.Unmarshal(body, &jsonData)
	if err != nil {
		return nil
	}

	bodyParams := map[string]string{}
	for k, v := range jsonData {
		if strings.HasSuffix(k, "Key") ||
			strings.HasSuffix(k, "Secret") ||
			strings.HasSuffix(k, "Password") {
			bodyParams[k] = "[redacted]"
		} else {
			bodyParams[k] = fmt.Sprintf("%s", v)
		}
	}
	return bodyParams
}

// LogRequest logs request info to the specified logger.
func LogRequest(msg string, log logging.Logger, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		startTime := time.Now()
		writer := NewStatusCapturingResponseWriter(w)
		bodyParams := getBodyParams(req)
		next(writer, req)
		elapsedMs := time.Since(startTime).Milliseconds()

		fieldLogger := log.WithArgs(
			"method", req.Method,
			"url", req.URL.String(),
			"elapsed_ms", elapsedMs,
			"status", writer.GetStatus(),
			"req_size", req.ContentLength,
			"resp_size", writer.GetBytesSent(),
			"client_addr", req.RemoteAddr,
		)
		correlationId := writer.Header().Get("X-Correlation-Id")
		if correlationId != "" {
			fieldLogger = fieldLogger.WithArgs("X-Correlation-Id", correlationId)
		}
		for k, v := range bodyParams {
			fieldLogger = fieldLogger.WithArgs(k, v)
		}
		fieldLogger.Info(msg)
	}
}
