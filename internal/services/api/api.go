package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"net/http"
)

func InternalError(w http.ResponseWriter, req *http.Request, logger *slog.Logger, err error) {
	status := http.StatusInternalServerError
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text))
	logger.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}

func MethodNotAllowed(w http.ResponseWriter, req *http.Request, logger *slog.Logger) {
	status := http.StatusMethodNotAllowed
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text))
	logger.Error(text, "method", req.Method, "url", req.URL.String())
}

func BadRequestJson(w http.ResponseWriter, req *http.Request, logger *slog.Logger, err error) {
	status := http.StatusBadRequest
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text + err.Error()))
	logger.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}
