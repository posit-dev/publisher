package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/initialize"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type postInspectRequestBody struct {
	Python string `json:"python"`
	R      string `json:"r"`
}

type postInspectResponseBody struct {
	Configuration *config.Config `json:"configuration"`
	ProjectDir    string         `json:"projectDir"`
}

var errEntrypointNotFound = errors.New("entrypoint not found")

func getEntrypointPath(projectDir util.AbsolutePath, w http.ResponseWriter, req *http.Request, log logging.Logger) (util.RelativePath, error) {
	entrypoint := req.URL.Query().Get("entrypoint")
	if entrypoint == "" {
		return util.RelativePath{}, nil
	}
	entrypointPath, err := projectDir.SafeJoin(entrypoint)
	if err != nil {
		BadRequest(w, req, log, err)
		return util.RelativePath{}, err
	}
	exists, err := entrypointPath.Exists()
	if err != nil {
		InternalError(w, req, log, err)
		return util.RelativePath{}, err
	}
	if !exists {
		err = errEntrypointNotFound
		NotFound(w, log, err)
		return util.RelativePath{}, err
	}
	// Return a relative path version of the entrypoint
	relEntrypoint, err := entrypointPath.Rel(projectDir)
	if err != nil {
		InternalError(w, req, log, err)
		return util.RelativePath{}, err
	}
	return relEntrypoint, nil
}

func PostInspectHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b postInspectRequestBody
		err = dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}
		pythonPath := util.NewPath(b.Python, nil)
		rPath := util.NewPath(b.R, nil)

		response := []postInspectResponseBody{}

		if req.URL.Query().Get("recursive") == "true" {
			walker, err := matcher.NewMatchingWalker([]string{"*"}, projectDir, log)
			if err != nil {
				InternalError(w, req, log, err)
				return
			}
			err = walker.Walk(projectDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
				if err != nil {
					if errors.Is(err, os.ErrNotExist) {
						return nil
					} else {
						return err
					}
				}
				if !info.IsDir() {
					return nil
				}
				if path.Base() == ".posit" {
					// no need to inspect or recurse into .posit directories
					return filepath.SkipDir
				}
				relProjectDir, err := path.Rel(base)
				if err != nil {
					return err
				}
				entrypoint := req.URL.Query().Get("entrypoint")
				entrypointPath := util.NewRelativePath(entrypoint, base.Fs())
				configs, err := initialize.GetPossibleConfigs(path, pythonPath, rPath, entrypointPath, log)
				if err != nil {
					return err
				}
				for _, cfg := range configs {
					if cfg.Type == config.ContentTypeUnknown {
						continue
					}
					response = append(response, postInspectResponseBody{
						ProjectDir:    relProjectDir.String(),
						Configuration: cfg,
					})
				}
				return nil
			})
			if err != nil {
				InternalError(w, req, log, err)
				return
			}
		} else {
			entrypointPath, err := getEntrypointPath(projectDir, w, req, log)
			if err != nil {
				// Response already returned by getEntrypointPath
				return
			}
			configs, err := initialize.GetPossibleConfigs(projectDir, pythonPath, util.Path{}, entrypointPath, log)
			if err != nil {
				InternalError(w, req, log, err)
				return
			}
			response = make([]postInspectResponseBody, 0, len(configs))
			for _, cfg := range configs {
				response = append(response, postInspectResponseBody{
					ProjectDir:    relProjectDir.String(),
					Configuration: cfg,
				})
			}
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
