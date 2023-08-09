package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

func InternalError(w http.ResponseWriter, logger rslog.Logger, err error) {
	status := http.StatusMethodNotAllowed
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text))
	logger.Errorf("%s: %s", text, err)
}

func MethodNotAllowed(w http.ResponseWriter, req *http.Request, logger rslog.Logger) {
	status := http.StatusMethodNotAllowed
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text))
	logger.Errorf("%s %s: %s", req.Method, req.URL.String(), text)
}

func BadRequestJson(w http.ResponseWriter, req *http.Request, logger rslog.Logger, err error) {
	status := http.StatusBadRequest
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text + err.Error()))
	logger.Errorf("%s %s: %s: %s", req.Method, req.URL.String(), text, err)
}
