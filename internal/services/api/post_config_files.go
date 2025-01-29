package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"slices"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type fileAction string

const (
	fileActionInclude fileAction = "include"
	fileActionExclude fileAction = "exclude"
)

type postConfigFilesRequest struct {
	Action fileAction `json:"action"`
	Path   string     `json:"path"`
}

func applyFileAction(cfg *config.Config, action fileAction, path string) error {
	switch action {
	case fileActionInclude:
		pattern := "!" + path
		index := slices.Index(cfg.Files, pattern)
		if index != -1 {
			// Remove the exclusion, which will include the file
			cfg.Files = slices.Delete(cfg.Files, index, index+1)
		} else {
			// Add the path, which will include the file
			if !slices.Contains(cfg.Files, path) {
				cfg.Files = append(cfg.Files, path)
			}
		}
		return nil
	case fileActionExclude:
		index := slices.Index(cfg.Files, path)
		if index != -1 {
			// Remove the file from the list, which will exclude it
			cfg.Files = slices.Delete(cfg.Files, index, index+1)
		} else {
			// Add an exclusion pattern, which will exclude the file
			pattern := "!" + path
			if !slices.Contains(cfg.Files, pattern) {
				cfg.Files = append(cfg.Files, pattern)
			}
		}
		return nil
	default:
		return fmt.Errorf("invalid action: %s", action)
	}
}

func PostConfigFilesHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		configPath := config.GetConfigPath(projectDir, name)
		// Defaults are specifically NOT to be inserted with this patch operation of the config
		// Otherwise, we'd write the defaults into the file on disk which would turn them into
		// user provided values.
		cfg, err := config.FromFile(configPath, nil, nil)
		if err != nil && errors.Is(err, fs.ErrNotExist) {
			http.NotFound(w, req)
			return
		}
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b postConfigFilesRequest
		err = dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		err = applyFileAction(cfg, b.Action, b.Path)
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
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
