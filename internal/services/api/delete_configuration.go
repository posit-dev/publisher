package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

func DeleteConfigurationHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		path := config.GetConfigPath(base, name)
		err := path.Remove()
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, req)
			} else {
				InternalError(w, req, log, err)
			}
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
