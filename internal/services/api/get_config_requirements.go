package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type GetConfigRequirementsHandler struct {
	base      util.AbsolutePath
	log       logging.Logger
	inspector inspect.PythonInspector
}

func NewGetConfigRequirementsHandler(base util.AbsolutePath, log logging.Logger) *GetConfigRequirementsHandler {
	return &GetConfigRequirementsHandler{
		base:      base,
		log:       log,
		inspector: inspect.NewPythonInspector(base, util.Path{}, log),
	}
}

func (h *GetConfigRequirementsHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	name := mux.Vars(req)["name"]
	configPath := config.GetConfigPath(h.base, name)
	cfg, err := config.FromFile(configPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			NotFound(w, h.log, err)
		} else {
			InternalError(w, req, h.log, err)
		}
		return
	}

	requirementsFilename := cfg.Python.PackageFile
	if requirementsFilename == "" {
		requirementsFilename = inspect.PythonRequirementsFilename
	}

	path := h.base.Join(requirementsFilename)
	reqs, err := h.inspector.ReadRequirementsFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			NotFound(w, h.log, err)
		} else {
			InternalError(w, req, h.log, err)
		}
		return
	}
	response := requirementsDTO{
		Requirements: reqs,
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(response)
}
