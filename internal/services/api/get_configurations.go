package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
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

		response := make([]configDTO, 0)
		if req.URL.Query().Get("recursive") == "true" {
			// Recursively search for .posit directories
			walker, err := matcher.NewMatchingWalker([]string{"*"}, projectDir, log)
			if err != nil {
				InternalError(w, req, log, err)
				return
			}
			err = walker.Walk(projectDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
				if err != nil {
					return err
				}
				if !info.IsDir() {
					return nil
				}
				if path.Base() == ".posit" {
					// Parent is a potential project directory
					parent := path.Dir()
					relParent, err := parent.Rel(base)
					if err != nil {
						return err
					}
					files, err := readConfigFiles(parent, relParent, entrypoint)
					if err != nil {
						return err
					}
					response = append(response, files...)
					// no need to recurse into .posit directories
					return filepath.SkipDir
				}
				return nil
			})
			if err != nil {
				InternalError(w, req, log, err)
				return
			}
		} else {
			response, err = readConfigFiles(projectDir, relProjectDir, entrypoint)
		}
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
