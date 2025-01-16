package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish"
	"github.com/posit-dev/publisher/internal/util"
)

func PostDeploymentCancelHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		localId := mux.Vars(req)["localid"]
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		path := deployment.GetDeploymentPath(projectDir, name)
		latest, err := publish.CancelDeployment(path, localId, log)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, req)
			} else {
				InternalError(w, req, log, err)
			}
			return
		}
		response := deploymentAsDTO(latest, err, projectDir, relProjectDir, path)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
