package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type PostRequirementsInspectResponse struct {
	Requirements []string          `json:"requirements"`
	Python       string            `json:"python"`
	Error        *types.AgentError `json:"error,omitempty"`
}

type PostRequirementsInspectHandler struct {
	base      util.Path
	log       logging.Logger
	inspector inspect.PythonInspector
}

func NewPostRequirementsInspectHandler(base util.Path, log logging.Logger) *PostRequirementsInspectHandler {
	return &PostRequirementsInspectHandler{
		base:      base,
		log:       log,
		inspector: inspect.NewPythonInspector(util.Path{}, log),
	}
}

func (h *PostRequirementsInspectHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	reqs, python, err := h.inspector.GetRequirements(h.base)
	response := PostRequirementsInspectResponse{
		Requirements: reqs,
		Python:       python,
		Error:        types.AsAgentError(err),
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(response)
}
