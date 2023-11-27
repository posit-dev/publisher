package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type getConfigurationsResponse map[string]any

func readConfigFiles(base util.Path) (getConfigurationsResponse, error) {
	paths, err := config.ListConfigFiles(base)
	if err != nil {
		return nil, err
	}
	response := getConfigurationsResponse{}
	for _, path := range paths {
		name := path.Base()
		cfg, err := config.FromFile(path)
		if err != nil {
			response[name] = map[string]string{
				"error": err.Error(),
			}
		} else {
			response[name] = cfg
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
