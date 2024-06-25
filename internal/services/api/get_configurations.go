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

type configDTO struct {
	Name          string            `json:"configurationName"`    // Config filename minus .toml
	Path          string            `json:"configurationPath"`    // Full path to config file
	RelPath       string            `json:"configurationRelPath"` // Relative path to config file from the global base directory
	ProjectDir    string            `json:"projectDir"`           // Relative path to the project directory from the global base
	Configuration *config.Config    `json:"configuration,omitempty"`
	Error         *types.AgentError `json:"error,omitempty"`
}

func readConfigFiles(projectDir util.AbsolutePath, relProjectDir util.RelativePath) ([]configDTO, error) {
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

		if err != nil {
			response = append(response, configDTO{
				Name:       name,
				Path:       path.String(),
				RelPath:    relPath.String(),
				ProjectDir: relProjectDir.String(),
				Error:      types.AsAgentError(err),
			})
		} else {
			response = append(response, configDTO{
				Name:          name,
				Path:          path.String(),
				RelPath:       relPath.String(),
				ProjectDir:    relProjectDir.String(),
				Configuration: cfg,
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
		response, err := readConfigFiles(projectDir, relProjectDir)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
