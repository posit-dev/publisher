package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

const internalErrorMsg = "Internal server error"

func InternalError(w http.ResponseWriter, logger rslog.Logger, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	w.Write([]byte(internalErrorMsg))
	logger.Errorf("%s: %s", internalErrorMsg, err)
}

const methodNotAllowedMsg = "Internal server error"

func MethodNotAllowed(w http.ResponseWriter, req *http.Request, logger rslog.Logger) {
	w.WriteHeader(http.StatusMethodNotAllowed)
	w.Write([]byte(methodNotAllowedMsg))
	logger.Errorf("%s %s: %s", req.Method, req.URL.String(), methodNotAllowedMsg)
}

const badRequestJsonMsg = "Bad request: "

func BadRequestJson(w http.ResponseWriter, req *http.Request, logger rslog.Logger, err error) {
	w.WriteHeader(http.StatusBadRequest)
	w.Write([]byte(badRequestJsonMsg + err.Error()))
	logger.Errorf("%s %s: %s: %s", req.Method, req.URL.String(), badRequestJsonMsg, err)
}
