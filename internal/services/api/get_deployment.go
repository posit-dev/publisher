package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

func readLatestDeploymentFile(base util.Path, name string) (*deploymentDTO, error) {
	path := deployment.GetDeploymentPath(base, name)
	d, err := deployment.FromFile(path)
	if err != nil {
		// Not found errors will return a 404
		if errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}
		// Other errors are returned to the caller
		return &deploymentDTO{
			Name:  name,
			Path:  path.String(),
			Error: types.AsAgentError(err),
		}, nil
	} else {
		configPath := config.GetConfigPath(base, d.ConfigName)
		relPath, err := configPath.Rel(base)
		if err != nil {
			// This error should never happen. But, if it does,
			// still return as much data as we can.
			relPath = configPath
		}
		return &deploymentDTO{
			Name:       name,
			Path:       path.String(),
			ConfigPath: relPath.String(),
			Deployment: d,
		}, nil
	}
}

func GetDeploymentHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		response, err := readLatestDeploymentFile(base, name)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, req)
			} else {
				InternalError(w, req, log, err)
			}
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
