package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func DeleteConfigurationHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		path := config.GetConfigPath(projectDir, name)

		err = path.Remove()
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
