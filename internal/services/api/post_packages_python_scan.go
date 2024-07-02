package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
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
	projectDir, _, err := ProjectDirFromRequest(h.base, w, req, h.log)
	if err != nil {
		// Response already returned by ProjectDirFromRequest
		return
	}
	dec := json.NewDecoder(req.Body)
	dec.DisallowUnknownFields()
	var b PostPackagesPythonScanRequest
	err = dec.Decode(&b)
	if err != nil && !errors.Is(err, io.EOF) {
		BadRequest(w, req, h.log, err)
		return
	}
	if b.SaveName == "" {
		b.SaveName = inspect.PythonRequirementsFilename
	}
	python := util.NewPath(b.Python, nil)
	inspector := inspectorFactory(projectDir, python, h.log)
	err = util.ValidateFilename(b.SaveName)
	if err != nil {
		BadRequest(w, req, h.log, err)
		return
	}
	reqs, _, err := inspector.ScanRequirements(projectDir)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	dest := projectDir.Join(b.SaveName)
	err = inspector.WriteRequirementsFile(dest, reqs)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
