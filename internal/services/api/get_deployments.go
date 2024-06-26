package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func readLatestDeploymentFiles(projectDir util.AbsolutePath, relProjectDir util.RelativePath) ([]any, error) {
	paths, err := deployment.ListDeploymentFiles(projectDir)
	if err != nil {
		return nil, err
	}
	response := make([]any, 0, len(paths))
	for _, path := range paths {
		d, err := deployment.FromFile(path)
		response = append(response, deploymentAsDTO(d, err, projectDir, relProjectDir, path))
	}
	return response, nil
}

func GetDeploymentsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		response, err := readLatestDeploymentFiles(projectDir, relProjectDir)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
