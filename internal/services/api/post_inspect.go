package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/initialize"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type postInspectRequestBody struct {
	Python string `json:"python"`
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

		configs, err := initialize.GetPossibleConfigs(projectDir, util.NewPath(b.Python, nil), util.Path{}, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		response := make([]configDTO, 0, len(configs))
		for _, cfg := range configs {
			response = append(response, configDTO{
				configLocation: configLocation{},
				ProjectDir:     relProjectDir.String(),
				Configuration:  cfg,
				Error:          nil,
			})
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
