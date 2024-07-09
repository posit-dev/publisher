package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func readLatestDeploymentFiles(projectDir util.AbsolutePath, relProjectDir util.RelativePath, entrypoint string) ([]any, error) {
	paths, err := deployment.ListDeploymentFiles(projectDir)
	if err != nil {
		return nil, err
	}
	response := make([]any, 0, len(paths))
	for _, path := range paths {
		d, err := deployment.FromFile(path)
		if entrypoint != "" {
			// Filter out non-matching entrypoints
			if d == nil || d.Configuration == nil || d.Configuration.Entrypoint != entrypoint {
				continue
			}
		}
		response = append(response, deploymentAsDTO(d, err, projectDir, relProjectDir, path))
	}
	return response, nil
}

func GetDeploymentsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		response := make([]any, 0)
		entrypoint := req.URL.Query().Get("entrypoint")

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
					files, err := readLatestDeploymentFiles(parent, relParent, entrypoint)
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
			response, err = readLatestDeploymentFiles(projectDir, relProjectDir, entrypoint)
		}
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
