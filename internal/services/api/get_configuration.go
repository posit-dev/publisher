package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

func GetConfigurationHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		path := config.GetConfigPath(base, name)
		cfg, err := config.FromFile(path)
		if err != nil && errors.Is(err, fs.ErrNotExist) {
			http.NotFound(w, req)
			return
		}
		w.Header().Set("content-type", "application/json")
		if err != nil {
			response := &configDTO{
				Name:  name,
				Path:  path.String(),
				Error: types.AsAgentError(err),
			}
			json.NewEncoder(w).Encode(response)
		} else {
			response := &configDTO{
				Name:          name,
				Path:          path.String(),
				Configuration: cfg,
			}
			json.NewEncoder(w).Encode(response)
		}
	}
}
