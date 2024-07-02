package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/initialize"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type postInspectRequestBody struct {
	Python string `json:"python"`
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
		entrypointPath, err := getEntrypointPath(projectDir, w, req, log)
		if err != nil {
			// Response already returned by getEntrypointPath
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
		configs, err := initialize.GetPossibleConfigs(projectDir, pythonPath, util.Path{}, entrypointPath, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response := make([]postInspectResponseBody, 0, len(configs))
		for _, cfg := range configs {
			response = append(response, postInspectResponseBody{
				ProjectDir:    relProjectDir.String(),
				Configuration: cfg,
			})
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
