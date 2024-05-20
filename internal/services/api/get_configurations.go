package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type configDTO struct {
	Name          string            `json:"configurationName"`
	Path          string            `json:"configurationPath"`
	RelPath       string            `json:"configurationRelPath"`
	Configuration *config.Config    `json:"configuration,omitempty"`
	Error         *types.AgentError `json:"error,omitempty"`
}

func readConfigFiles(base util.AbsolutePath) ([]configDTO, error) {
	paths, err := config.ListConfigFiles(base)
	if err != nil {
		return nil, err
	}
	response := make([]configDTO, 0, len(paths))
	for _, path := range paths {
		name := strings.TrimSuffix(path.Base(), ".toml")
		relPath, err := path.Rel(base)
		if err != nil {
			return nil, err
		}

		cfg, err := config.FromFile(path)

		if err != nil {
			response = append(response, configDTO{
				Name:    name,
				Path:    path.String(),
				RelPath: relPath.String(),
				Error:   types.AsAgentError(err),
			})
		} else {
			response = append(response, configDTO{
				Name:          name,
				Path:          path.String(),
				RelPath:       relPath.String(),
				Configuration: cfg,
			})
		}
	}
	return response, nil
}

func GetConfigurationsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		response, err := readConfigFiles(base)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
