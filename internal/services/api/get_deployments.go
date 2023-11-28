package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type deploymentDTO struct {
	ID         string                 `json:"id"`
	Deployment *deployment.Deployment `json:"deployment,omitempty"`
	Error      string                 `json:"error,omitempty"`
}

func readLatestDeploymentFiles(base util.Path) ([]deploymentDTO, error) {
	paths, err := deployment.ListLatestDeploymentFiles(base)
	if err != nil {
		return nil, err
	}
	response := make([]deploymentDTO, 0, len(paths))
	for _, path := range paths {
		d, err := deployment.FromFile(path)
		if err != nil {
			response = append(response, deploymentDTO{
				ID:    path.Dir().Base(),
				Error: err.Error(),
			})
		} else {
			response = append(response, deploymentDTO{
				ID:         path.Dir().Base(),
				Deployment: d,
			})
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
