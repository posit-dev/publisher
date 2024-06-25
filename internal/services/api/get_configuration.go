package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

func GetConfigurationHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		path := config.GetConfigPath(projectDir, name)
		relPath, err := path.Rel(projectDir)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		cfg, err := config.FromFile(path)
		if err != nil && errors.Is(err, fs.ErrNotExist) {
			http.NotFound(w, req)
			return
		}
		w.Header().Set("content-type", "application/json")
		if err != nil {
			response := &configDTO{
				Name:       name,
				Path:       path.String(),
				RelPath:    relPath.String(),
				ProjectDir: relProjectDir.String(),
				Error:      types.AsAgentError(err),
			}
			json.NewEncoder(w).Encode(response)
		} else {
			response := &configDTO{
				Name:          name,
				Path:          path.String(),
				RelPath:       relPath.String(),
				ProjectDir:    relProjectDir.String(),
				Configuration: cfg,
			}
			json.NewEncoder(w).Encode(response)
		}
	}
}
