package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type configLocation struct {
	Name    string `json:"configurationName"`    // Config filename minus .toml
	Path    string `json:"configurationPath"`    // Full path to config file
	RelPath string `json:"configurationRelPath"` // Relative path to config file from the global base directory
}

type configDTO struct {
	configLocation
	ProjectDir    string            `json:"projectDir"` // Relative path to the project directory from the global base
	Configuration *config.Config    `json:"configuration,omitempty"`
	Error         *types.AgentError `json:"error,omitempty"`
}

func readConfigFiles(projectDir util.AbsolutePath, relProjectDir util.RelativePath, entrypoint string) ([]configDTO, error) {
	paths, err := config.ListConfigFiles(projectDir)
	if err != nil {
		return nil, err
	}
	response := make([]configDTO, 0, len(paths))
	for _, path := range paths {
		name := strings.TrimSuffix(path.Base(), ".toml")
		relPath, err := path.Rel(projectDir)
		if err != nil {
			return nil, err
		}

		cfg, err := config.FromFile(path)

		if entrypoint != "" {
			// Filter out non-matching entrypoints
			if cfg == nil || cfg.Entrypoint != entrypoint {
				continue
			}
		}
		if err != nil {
			response = append(response, configDTO{
				configLocation: configLocation{
					Name:    name,
					Path:    path.String(),
					RelPath: relPath.String(),
				},
				ProjectDir:    relProjectDir.String(),
				Configuration: nil,
				Error:         types.AsAgentError(err),
			})
		} else {
			response = append(response, configDTO{
				configLocation: configLocation{
					Name:    name,
					Path:    path.String(),
					RelPath: relPath.String(),
				},
				ProjectDir:    relProjectDir.String(),
				Configuration: cfg,
				Error:         nil,
			})
		}
	}
	return response, nil
}

func GetConfigurationsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		entrypoint := req.URL.Query().Get("entrypoint")
		response, err := readConfigFiles(projectDir, relProjectDir, entrypoint)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
