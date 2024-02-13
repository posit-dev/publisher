package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
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

func BadRequest(w http.ResponseWriter, req *http.Request, log logging.Logger, err error) {
	status := http.StatusBadRequest
	text := http.StatusText(status)
	w.WriteHeader(status)
	fmt.Fprintf(w, "%s: %s\n", text, err.Error())
	log.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}

func NotFound(w http.ResponseWriter, log logging.Logger, err error) {
	msg := err.Error()
	log.Error(msg)
	http.Error(w, msg, http.StatusNotFound)
}
