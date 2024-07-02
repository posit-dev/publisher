package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
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

func PostInspectHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		projectDir, relProjectDir, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		entrypoint := req.URL.Query().Get("entrypoint")
		entrypointPath := util.NewRelativePath(entrypoint, base.Fs())

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
