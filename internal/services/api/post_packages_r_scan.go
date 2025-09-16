package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type PostPackagesRScanRequest struct {
	R        string             `json:"r"`
	SaveName string             `json:"saveName"`
	Positron *positronSettings `json:"positron,omitempty"`
}

type PostPackagesRScanHandler struct {
	base               util.AbsolutePath
	log                logging.Logger
	rDependencyScanner renv.RDependencyScanner
}

func NewPostPackagesRScanHandler(
	base util.AbsolutePath,
	log logging.Logger,
) *PostPackagesRScanHandler {
    return &PostPackagesRScanHandler{
        base:               base,
        log:                log,
        rDependencyScanner: renv.NewRDependencyScanner(log, nil),
    }
}

func (h *PostPackagesRScanHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	projectDir, _, err := ProjectDirFromRequest(h.base, w, req, h.log)
	if err != nil {
		// Response already returned by ProjectDirFromRequest
		return
	}
	rInterpreter, _, err := InterpretersFromRequest(projectDir, w, req, h.log)
	if err != nil {
		// Response already returned by InterpretersFromRequest
		return
	}
	rExecutablePath, err := rInterpreter.GetRExecutable()
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	dec := json.NewDecoder(req.Body)
	dec.DisallowUnknownFields()
	var b PostPackagesRScanRequest
	err = dec.Decode(&b)
	if err != nil && !errors.Is(err, io.EOF) {
		BadRequest(w, req, h.log, err)
		return
	}
	if b.SaveName == "" {
		b.SaveName = interpreters.DefaultRenvLockfile
	}
	// Can't call ValidateFilename on b.SaveName because
	// it may contain slashes.
	lockfileRelPath := util.NewRelativePath(filepath.FromSlash(b.SaveName), nil)
	err = util.ValidateFilename(lockfileRelPath.Base())
	if err != nil {
		BadRequest(w, req, h.log, err)
		return
	}
	// Choose scanner: if Positron settings were provided, build a scanner with options;
	// otherwise use the handler's default (for testability and backward-compat).
    scanner := h.rDependencyScanner
    if b.Positron != nil && b.Positron.R != nil {
        scanner = renv.NewRDependencyScanner(h.log, &renv.RepoOptions{
            DefaultRepositories:      b.Positron.R.DefaultRepositories,
            PackageManagerRepository: b.Positron.R.PackageManagerRepository,
        })
    }

	_, err = scanner.SetupRenvInDir(projectDir.String(), lockfileRelPath.String(), rExecutablePath.String())
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
