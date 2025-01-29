package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type PostPackagesPythonScanRequest struct {
	Python   string `json:"python"`
	SaveName string `json:"saveName"`
}

type PostPackagesPythonScanResponse struct {
	Python       string   `json:"python"`
	Requirements []string `json:"requirements"`
	Incomplete   []string `json:"incomplete"`
}

var inspectorFactory = inspect.NewPythonInspector

type PostPackagesPythonScanHandler struct {
	base   util.AbsolutePath
	log    logging.Logger
	python *interpreters.PythonInterpreter
}

func NewPostPackagesPythonScanHandler(base util.AbsolutePath, log logging.Logger, alternatePythonInterpreter *interpreters.PythonInterpreter) *PostPackagesPythonScanHandler {
	return &PostPackagesPythonScanHandler{
		base:   base,
		log:    log,
		python: alternatePythonInterpreter,
	}
}

func (h *PostPackagesPythonScanHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	projectDir, _, err := ProjectDirFromRequest(h.base, w, req, h.log)
	if err != nil {
		// Response already returned by ProjectDirFromRequest
		return
	}
	if h.python == nil {
		_, pythonInterpreter, err := InterpretersFromRequest(h.base, w, req, h.log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		h.python = pythonInterpreter
	}
	if h.python == nil {
		InternalError(w, req, h.log, interpreters.MissingPythonError)
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
		b.SaveName = interpreters.PythonRequirementsFilename
	}
	inspector, err := inspectorFactory(projectDir, h.python, h.log, nil)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	err = util.ValidateFilename(b.SaveName)
	if err != nil {
		BadRequest(w, req, h.log, err)
		return
	}
	reqs, incomplete, effectivePython, err := inspector.ScanRequirements(projectDir)
	if err != nil {
		if aerr, ok := types.IsAgentErrorOf(err, types.ErrorPythonExecNotFound); ok {
			apiErr := types.APIErrorPythonExecNotFoundFromAgentError(*aerr)
			h.log.Error("Python executable not found", "error", err.Error())
			apiErr.JSONResponse(w)
			return
		}

		InternalError(w, req, h.log, err)
		return
	}
	pythonPath, err := (*h.python).GetPythonExecutable()
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	dest := projectDir.Join(b.SaveName)
	err = pydeps.WriteRequirementsFile(dest, reqs, pythonPath)
	if err != nil {
		InternalError(w, req, h.log, err)
		return
	}
	response := PostPackagesPythonScanResponse{
		Python:       effectivePython,
		Requirements: reqs,
		Incomplete:   incomplete,
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(response)
}
