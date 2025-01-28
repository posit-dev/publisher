package api

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

const (
	secretActionAdd    = "add"
	secretActionRemove = "remove"
)

type postConfigSecretsRequest struct {
	Action string `json:"action"`
	Secret string `json:"secret"`
}

func applySecretAction(cfg *config.Config, action string, secret string) error {
	switch action {
	case secretActionAdd:
		return cfg.AddSecret(secret)
	case secretActionRemove:
		return cfg.RemoveSecret(secret)
	default:
		return fmt.Errorf("unknown action: %s", action)
	}
}

func PostConfigSecretsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]

		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
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

		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b postConfigSecretsRequest
		err = dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		err = applySecretAction(cfg, b.Action, b.Secret)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		err = cfg.WriteFile(configPath)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		relPath, err := configPath.Rel(base)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		response := &configDTO{
			configLocation: configLocation{
				Name:    name,
				Path:    configPath.String(),
				RelPath: relPath.String(),
			},
			ProjectDir:    relProjectDir.String(),
			Configuration: cfg,
		}
		JsonResult(w, http.StatusOK, response)
	}
}
