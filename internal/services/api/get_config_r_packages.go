package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type getConfigRPackagesHandler struct {
	base util.AbsolutePath
	log  logging.Logger
}

func NewGetConfigRPackagesHandler(base util.AbsolutePath, log logging.Logger) *getConfigRPackagesHandler {
	return &getConfigRPackagesHandler{
		base: base,
		log:  log,
	}
}

func (h *getConfigRPackagesHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	name := mux.Vars(req)["name"]
	projectDir, _, err := ProjectDirFromRequest(h.base, w, req, h.log)
	if err != nil {
		// Response already returned by ProjectDirFromRequest
		return
	}
	configPath := config.GetConfigPath(projectDir, name)
	cfg, err := config.FromFile(configPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			NotFound(w, h.log, err)
		} else {
			InternalError(w, req, h.log, err)
		}
		return
	}

	if cfg.R == nil {
		// Not an R project; there are no R packages.
		// We distinguish this from the case where there is
		// no lockfile (404).
		w.WriteHeader(http.StatusConflict)
		return
	}
	packageFilename := cfg.R.PackageFile
	if packageFilename == "" {
		packageFilename = interpreters.DefaultRenvLockfile
	}

	path := projectDir.Join(packageFilename)
	response, err := renv.ReadLockfile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			NotFound(w, h.log, err)
		} else {
			msg := "could not read renv lockfile"
			w.WriteHeader(http.StatusUnprocessableEntity)
			w.Write([]byte(msg))
			h.log.Error(msg, "method", req.Method, "url", req.URL.String(), "error", err)
		}
		return
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(response)
}
