package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type configDTO struct {
	Name          string         `json:"configuration-name"`
	Path          string         `json:"configuration-path"`
	Configuration *config.Config `json:"configuration,omitempty"`
	Error         string         `json:"error,omitempty"`
}

func readConfigFiles(base util.Path) ([]configDTO, error) {
	paths, err := config.ListConfigFiles(base)
	if err != nil {
		return nil, err
	}
	response := make([]configDTO, 0, len(paths))
	for _, path := range paths {
		name := strings.TrimSuffix(path.Base(), ".toml")
		cfg, err := config.FromFile(path)
		if err != nil {
			response = append(response, configDTO{
				Name:  name,
				Path:  path.String(),
				Error: err.Error(),
			})
		} else {
			response = append(response, configDTO{
				Name:          name,
				Path:          path.String(),
				Configuration: cfg,
			})
		}
	}
	return response, nil
}

func GetConfigurationsHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		response, err := readConfigFiles(base)
		if err != nil {
			InternalError(w, req, log, err)
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
