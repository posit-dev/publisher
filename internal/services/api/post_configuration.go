package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

func PostConfigurationHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		err := util.ValidateFilename(name)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var cfgIn config.Config
		err = dec.Decode(&cfgIn)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		configPath := config.GetConfigPath(base, name)
		err = cfgIn.WriteFile(configPath)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		// Validate and return the configuration
		configOut, err := config.FromFile(configPath)
		var response configDTO
		if err != nil {
			response = configDTO{
				Name:  name,
				Path:  configPath.String(),
				Error: types.AsAgentError(err),
			}
		} else {
			response = configDTO{
				Name:          name,
				Path:          configPath.String(),
				Configuration: configOut,
			}
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
