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
		dir := req.URL.Query().Get("dir")

		projectDir, err := base.SafeJoin(dir)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		// We will return a normalized version of the project directory
		relProjectDir, err := projectDir.Rel(base)
		if err != nil {
			InternalError(w, req, log, err)
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
