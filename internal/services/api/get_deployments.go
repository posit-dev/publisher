package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type getDeploymentsResponse map[string]any

func readLatestDeploymentFiles(base util.Path) (getDeploymentsResponse, error) {
	paths, err := deployment.ListLatestDeploymentFiles(base)
	if err != nil {
		return nil, err
	}
	response := getDeploymentsResponse{}
	for _, path := range paths {
		name := path.Dir().Base()
		d, err := deployment.FromFile(path)
		if err != nil {
			response[name] = map[string]string{
				"error": err.Error(),
			}
		} else {
			response[name] = d
		}
	}
	return response, nil
}

func GetDeploymentsHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		response, err := readLatestDeploymentFiles(base)
		if err != nil {
			InternalError(w, req, log, err)
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
