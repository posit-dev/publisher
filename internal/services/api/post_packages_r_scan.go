package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type PostPackagesRScanRequest struct {
	R        string `json:"r"`
	SaveName string `json:"saveName"`
}

type PostPackagesRScanHandler struct {
	base util.AbsolutePath
	log  logging.Logger
}

func NewPostPackagesRScanHandler(base util.AbsolutePath, log logging.Logger) *PostPackagesRScanHandler {
	return &PostPackagesRScanHandler{
		base: base,
		log:  log,
	}
}

func (h *PostPackagesRScanHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	projectDir, _, err := ProjectDirFromRequest(h.base, w, req, h.log)
	if err != nil {
		// Response already returned by ProjectDirFromRequest
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
	path := util.NewRelativePath(filepath.FromSlash(b.SaveName), nil)
	err = util.ValidateFilename(path.Base())
	if err != nil {
		BadRequest(w, req, h.log, err)
		return
	}
	lockfileAbsPath := projectDir.Join(path.String())
	rPath := util.NewPath(b.R, nil)

	rInterpreter := interpreters.NewRInterpreter(projectDir, rPath, h.log)
	err = rInterpreter.Init()
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	err = rInterpreter.CreateLockfile(lockfileAbsPath)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
