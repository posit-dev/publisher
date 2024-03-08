package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type requirementsDTO struct {
	Requirements []string          `json:"requirements"`
	Error        *types.AgentError `json:"error,omitempty"`
}

type GetRequirementsHandler struct {
	base      util.Path
	log       logging.Logger
	inspector inspect.PythonInspector
}

func NewGetRequirementsHandler(base util.Path, log logging.Logger) *GetRequirementsHandler {
	return &GetRequirementsHandler{
		base:      base,
		log:       log,
		inspector: inspect.NewPythonInspector(base, util.Path{}, log),
	}
}

func (h *GetRequirementsHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	path := h.base.Join(inspect.PythonRequirementsFilename)
	reqs, err := h.inspector.ReadRequirementsFile(path)
	if err != nil && errors.Is(err, fs.ErrNotExist) {
		NotFound(w, h.log, err)
		return
	}
	response := requirementsDTO{
		Requirements: reqs,
		Error:        types.AsAgentError(err),
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(response)
}