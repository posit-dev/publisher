package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type PostPackagesPythonScanRequest struct {
	SaveName string `json:"saveName"`
}

type PostPackagesPythonScanHandler struct {
	base      util.AbsolutePath
	log       logging.Logger
	inspector inspect.PythonInspector
}

func NewPostPackagesPythonScanHandler(base util.AbsolutePath, log logging.Logger) *PostPackagesPythonScanHandler {
	return &PostPackagesPythonScanHandler{
		base:      base,
		log:       log,
		inspector: inspect.NewPythonInspector(base, util.Path{}, log),
	}
}

func (h *PostPackagesPythonScanHandler) scan(saveName string) error {
	reqs, _, err := h.inspector.ScanRequirements(h.base)
	if err != nil {
		return err
	}
	dest := h.base.Join(saveName)
	return h.inspector.WriteRequirementsFile(dest, reqs)
}

func (h *PostPackagesPythonScanHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	dec := json.NewDecoder(req.Body)
	dec.DisallowUnknownFields()
	var b PostPackagesPythonScanRequest
	err := dec.Decode(&b)
	if err != nil && !errors.Is(err, io.EOF) {
		BadRequest(w, req, h.log, err)
		return
	}
	if b.SaveName == "" {
		b.SaveName = inspect.PythonRequirementsFilename
	}
	err = util.ValidateFilename(b.SaveName)
	if err != nil {
		BadRequest(w, req, h.log, err)
		return
	}
	err = h.scan(b.SaveName)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
