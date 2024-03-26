package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

func readLatestDeploymentFiles(base util.AbsolutePath) ([]any, error) {
	paths, err := deployment.ListDeploymentFiles(base)
	if err != nil {
		return nil, err
	}
	response := make([]any, 0, len(paths))
	for _, path := range paths {
		d, err := deployment.FromFile(path)
		response = append(response, deploymentAsDTO(d, err, base, path))
	}
	return response, nil
}

func GetDeploymentsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		response, err := readLatestDeploymentFiles(base)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
