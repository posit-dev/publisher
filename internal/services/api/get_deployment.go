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
	"github.com/rstudio/connect-client/internal/util"
)

func readLatestDeploymentFile(base util.Path, id string) (*deploymentDTO, error) {
	path := deployment.GetLatestDeploymentPath(base, id)
	d, err := deployment.FromFile(path)
	if err != nil {
		// Not found errors will return a 404
		if errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}
		// Other errors are returned to the caller
		return &deploymentDTO{
			Error: err.Error(),
		}, nil
	} else {
		return &deploymentDTO{
			ConfigPath: config.GetConfigPath(base, d.ConfigName).String(),
			Deployment: d,
		}, nil
	}
}

func GetDeploymentHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		id := mux.Vars(req)["id"]
		response, err := readLatestDeploymentFile(base, id)
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
