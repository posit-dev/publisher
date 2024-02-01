package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type configDTO struct {
	Name          string            `json:"configurationName"`
	Path          string            `json:"configurationPath"`
	Configuration *config.Config    `json:"configuration,omitempty"`
	Error         *types.AgentError `json:"error,omitempty"`
}

func readConfigFiles(base util.Path) ([]configDTO, error) {
	paths, err := config.ListConfigFiles(base)
	if err != nil {
		return nil, err
	}
	response := make([]configDTO, 0, len(paths))
	for _, path := range paths {
		relPath, err := path.Rel(base)
		if err != nil {
			// This error should never happen. But, if it does,
			// still return as much data as we can.
			relPath = path
		}
		name := strings.TrimSuffix(path.Base(), ".toml")
		cfg, err := config.FromFile(path)

		if err != nil {
			response = append(response, configDTO{
				Name:  name,
				Path:  relPath.String(),
				Error: types.AsAgentError(err),
			})
		} else {
			response = append(response, configDTO{
				Name:          name,
				Path:          relPath.String(),
				Configuration: cfg,
			})
		}
	}
	return response, nil
}

func GetConfigurationsHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		err := initialize.InitIfNeeded(base, config.DefaultConfigName, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response, err := readConfigFiles(base)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
