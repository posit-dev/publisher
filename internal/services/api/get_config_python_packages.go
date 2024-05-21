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

type getConfigPythonPackagesHandler struct {
	base      util.AbsolutePath
	log       logging.Logger
	inspector inspect.PythonInspector
}

type pythonPackagesDTO struct {
	Requirements []string `json:"requirements"`
}

func NewGetConfigPythonPackagesHandler(base util.AbsolutePath, log logging.Logger) *getConfigPythonPackagesHandler {
	return &getConfigPythonPackagesHandler{
		base:      base,
		log:       log,
		inspector: inspect.NewPythonInspector(base, util.Path{}, log),
	}
}

func (h *getConfigPythonPackagesHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
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

	if cfg.Python == nil {
		// Not a Python project; there are no requirements.
		// We distinguish this from the case where there is
		// an empty requirements file (200 with empty array),
		// or no requirements file (404).
		w.WriteHeader(http.StatusConflict)
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
	response := pythonPackagesDTO{
		Requirements: reqs,
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(response)
}
