package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type PostPackagesRScanRequest struct {
	SaveName string `json:"saveName"`
}

type PostPackagesRScanHandler struct {
	base      util.AbsolutePath
	log       logging.Logger
	inspector inspect.RInspector
}

func NewPostPackagesRScanHandler(base util.AbsolutePath, log logging.Logger) *PostPackagesRScanHandler {
	return &PostPackagesRScanHandler{
		base:      base,
		log:       log,
		inspector: inspect.NewRInspector(base, util.Path{}, log),
	}
}

func (h *PostPackagesRScanHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	dec := json.NewDecoder(req.Body)
	dec.DisallowUnknownFields()
	var b PostPackagesRScanRequest
	err := dec.Decode(&b)
	if err != nil && !errors.Is(err, io.EOF) {
		BadRequest(w, req, h.log, err)
		return
	}
	if b.SaveName == "" {
		b.SaveName = inspect.DefaultRenvLockfile
	}
	// Can't call ValidateFilename on b.SaveName because
	// it may contain slashes.
	path := util.NewRelativePath(filepath.FromSlash(b.SaveName), nil)
	err = util.ValidateFilename(path.Base())
	if err != nil {
		BadRequest(w, req, h.log, err)
		return
	}
	lockfileAbsPath := h.base.Join(path.String())
	err = h.inspector.CreateLockfile(lockfileAbsPath)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
