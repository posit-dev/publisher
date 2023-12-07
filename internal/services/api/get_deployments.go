package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type deploymentDTO struct {
	*deployment.Deployment
	ConfigPath string `json:"configurationPath,omitempty"`
	Error      string `json:"error,omitempty"`
}

func readLatestDeploymentFiles(base util.Path) ([]deploymentDTO, error) {
	paths, err := deployment.ListDeploymentFiles(base)
	if err != nil {
		return nil, err
	}
	response := make([]deploymentDTO, 0, len(paths))
	for _, path := range paths {
		d, err := deployment.FromFile(path)
		if err != nil {
			response = append(response, deploymentDTO{
				Error: err.Error(),
			})
		} else {
			response = append(response, deploymentDTO{
				ConfigPath: config.GetConfigPath(base, d.ConfigName).String(),
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
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
