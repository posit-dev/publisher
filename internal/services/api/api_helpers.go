package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"html"
	"net/http"

	"github.com/posit-dev/publisher/internal/logging"
)

func InternalError(w http.ResponseWriter, req *http.Request, log logging.Logger, err error) {
	status := http.StatusInternalServerError
	text := html.EscapeString(err.Error())
	w.Header().Add("Content-Type", "text/plain")
	w.WriteHeader(status)
	w.Write([]byte(text))
	log.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}

func NotFound(w http.ResponseWriter, log logging.Logger, err error) {
	msg := err.Error()
	log.Error(msg)
	http.Error(w, msg, http.StatusNotFound)
}

func JsonResult(w http.ResponseWriter, status int, result any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(result)
}

