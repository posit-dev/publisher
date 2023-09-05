package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/connect-client/internal/logging"
)

func InternalError(w http.ResponseWriter, req *http.Request, log logging.Logger, err error) {
	status := http.StatusInternalServerError
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text))
	log.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}

func MethodNotAllowed(w http.ResponseWriter, req *http.Request, log logging.Logger) {
	status := http.StatusMethodNotAllowed
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text))
	log.Error(text, "method", req.Method, "url", req.URL.String())
}

func BadRequestJson(w http.ResponseWriter, req *http.Request, log logging.Logger, err error) {
	status := http.StatusBadRequest
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text + err.Error()))
	log.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}
