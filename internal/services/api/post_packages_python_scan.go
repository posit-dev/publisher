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
	Python   string `json:"python"`
	SaveName string `json:"saveName"`
}

var inspectorFactory = inspect.NewPythonInspector

type PostPackagesPythonScanHandler struct {
	base util.AbsolutePath
	log  logging.Logger
}

func NewPostPackagesPythonScanHandler(base util.AbsolutePath, log logging.Logger) *PostPackagesPythonScanHandler {
	return &PostPackagesPythonScanHandler{
		base: base,
		log:  log,
	}
}

func (h *PostPackagesPythonScanHandler) scan(inspector inspect.PythonInspector, saveName string) error {
	reqs, _, err := inspector.ScanRequirements(h.base)
	if err != nil {
		return err
	}
	dest := h.base.Join(saveName)
	return inspector.WriteRequirementsFile(dest, reqs)
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
	python := util.NewPath(b.Python, nil)
	inspector := inspectorFactory(h.base, python, h.log)
	err = util.ValidateFilename(b.SaveName)
	if err != nil {
		BadRequest(w, req, h.log, err)
		return
	}
	err = h.scan(inspector, b.SaveName)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
