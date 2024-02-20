package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

func PutConfigurationHandlerFunc(base util.Path, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		err := util.ValidateFilename(name)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var configIn config.Config
		err = dec.Decode(&configIn)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		// Validate the configuration
		tempFile, err := os.CreateTemp("", "temp*.toml")
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		defer tempFile.Close()

		tempPath := util.NewPath(tempFile.Name(), base.Fs())
		defer tempPath.Remove()

		err = configIn.WriteFile(tempPath)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		var response configDTO
		configPath := config.GetConfigPath(base, name)

		configOut, err := config.FromFile(tempPath)
		if err != nil {
			response = configDTO{
				Name:  name,
				Path:  configPath.String(),
				Error: types.AsAgentError(err),
			}
		} else {
			// Write file only if it passed validation
			err = configOut.WriteFile(configPath)
			if err != nil {
				InternalError(w, req, log, err)
				return
			}
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
