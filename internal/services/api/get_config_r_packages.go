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
	"github.com/rstudio/connect-client/internal/inspect/dependencies/renv"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
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

	if cfg.R == nil {
		// Not an R project; there are no R packages.
		// We distinguish this from the case where there is
		// no lockfile (404).
		w.WriteHeader(http.StatusConflict)
		return
	}
	packageFilename := cfg.R.PackageFile
	if packageFilename == "" {
		packageFilename = inspect.DefaultRenvLockfile
	}

	path := h.base.Join(packageFilename)
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
