package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

const internalErrorMsg = "Internal server error"

func internalError(w http.ResponseWriter, logger rslog.Logger, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	w.Write([]byte(internalErrorMsg))
	logger.Errorf("%s: %s", internalErrorMsg, err)
}
