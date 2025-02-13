package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

var interpretersFromRequest = InterpretersFromRequest

// getInterpreterResponse is the format of returned interpreter data.
// It represents the defaults of the active interpreters, passed in
// the request.
type getInterpreterResponse struct {
	Python              *config.Python `json:"python,omitempty"`
	PreferredPythonPath string         `json:"preferredPythonPath,omitempty"`
	R                   *config.R      `json:"r,omitempty"`
	PreferredRPath      string         `json:"preferredRPath,omitempty"`
}

// toGetAccountResponse converts an internal Account object
// to the DTO type we return from the API.
func toGetInterpreterResponse(rInterpreter *interpreters.RInterpreter, pythonInterpreter *interpreters.PythonInterpreter) *getInterpreterResponse {

	rConfig := &config.R{}
	rConfig.FillDefaults(rInterpreter)
	preferredRPath := ""
	if rInterpreter != nil {
		preferredRPath = (*rInterpreter).GetPreferredPath()
	}

	pythonConfig := &config.Python{}
	pythonConfig.FillDefaults(pythonInterpreter)
	preferredPythonPath := ""
	if pythonInterpreter != nil {
		preferredPythonPath = (*pythonInterpreter).GetPreferredPath()
	}

	return &getInterpreterResponse{
		R:                   rConfig,
		PreferredRPath:      preferredRPath,
		Python:              pythonConfig,
		PreferredPythonPath: preferredPythonPath,
	}
}

func GetActiveInterpretersHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		rInterpreter, pythonInterpreter, err := interpretersFromRequest(projectDir, w, req, log)
		if err != nil {
			// Response already returned by InterpretersFromRequest
			return
		}

		response := toGetInterpreterResponse(rInterpreter, pythonInterpreter)
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
