package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type PostPackagesRScanRequest struct {
	R        string            `json:"r"`
	SaveName string            `json:"saveName"`
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
	// Choose scanner based on Positron settings (nil → defaults)
	scanner := h.rDependencyScanner
	if opts := repoOptsFromPositron(b.Positron); opts != nil {
		scanner = renv.NewRDependencyScanner(h.log, opts)
	}

	_, err = scanner.SetupRenvInDir(projectDir.String(), lockfileRelPath.String(), rExecutablePath.String())
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// repoOptsFromPositron converts inbound Positron settings to renv.RepoOptions.
// Returns nil if no Positron R settings were provided.
func repoOptsFromPositron(ps *positronSettings) *renv.RepoOptions {
	if ps == nil || ps.R == nil {
		return nil
	}
	mode := strings.TrimSpace(ps.R.DefaultRepositories)
	ppm := strings.TrimSpace(ps.R.PackageManagerRepository)
	return &renv.RepoOptions{
		DefaultRepositories:      mode,
		PackageManagerRepository: ppm,
	}
}
