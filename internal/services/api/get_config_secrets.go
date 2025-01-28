package api

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

func GetConfigSecretsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]

		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		rInterpreter, pythonInterpreter, err := InterpretersFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}

		configPath := config.GetConfigPath(projectDir, name)
		cfg, err := configFromFile(configPath, rInterpreter, pythonInterpreter)
		if err != nil {
			if aerr, ok := err.(*types.AgentError); ok {
				if aerr.Code == types.ErrorUnknownTOMLKey {
					apiErr := types.APIErrorUnknownTOMLKeyFromAgentError(*aerr)
					apiErr.JSONResponse(w)
					return
				}

				if aerr.Code == types.ErrorInvalidTOML {
					apiErr := types.APIErrorInvalidTOMLFileFromAgentError(*aerr)
					apiErr.JSONResponse(w)
					return
				}
			}

			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, req)
			} else {
				InternalError(w, req, log, err)
			}
			return
		}

		response := make([]string, 0)
		response = append(response, cfg.Secrets...)

		JsonResult(w, http.StatusOK, response)
	}
}
