package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"

	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func InternalError(w http.ResponseWriter, req *http.Request, log logging.Logger, err error) {
	status := http.StatusInternalServerError
	text := html.EscapeString(err.Error())
	w.Header().Add("Content-Type", "text/plain")
	w.WriteHeader(status)
	w.Write([]byte(text))
	log.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}

func MethodNotAllowed(w http.ResponseWriter, req *http.Request, log logging.Logger) {
	status := http.StatusMethodNotAllowed
	text := http.StatusText(status)
	w.WriteHeader(status)
	w.Write([]byte(text))
	log.Error(text, "method", req.Method, "url", req.URL.String())
}

func BadRequest(w http.ResponseWriter, req *http.Request, log logging.Logger, err error) {
	status := http.StatusBadRequest
	text := http.StatusText(status)
	w.WriteHeader(status)
	fmt.Fprintf(w, "%s: %s\n", text, err.Error())
	log.Error(text, "method", req.Method, "url", req.URL.String(), "error", err)
}

func NotFound(w http.ResponseWriter, log logging.Logger, err error) {
	msg := err.Error()
	log.Error(msg)
	http.Error(w, msg, http.StatusNotFound)
}

func JsonResult(w http.ResponseWriter, status int, result any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(result)
}

var errProjectDirNotFound = errors.New("project directory not found")

// ProjectDirFromRequest returns the project directory from the request query parameter "dir".
// If the directory does not exist, it returns a 404.
// If the directory is not a subdirectory of the base directory, it returns a 400.
// Other errors return a 500.
func ProjectDirFromRequest(base util.AbsolutePath, w http.ResponseWriter, req *http.Request, log logging.Logger) (util.AbsolutePath, util.RelativePath, error) {
	dir := req.URL.Query().Get("dir")
	log.Debug("Picking directory from request", "directory", dir)
	projectDir, err := base.SafeJoin(dir)
	if err != nil {
		BadRequest(w, req, log, err)
		return util.AbsolutePath{}, util.RelativePath{}, err
	}
	exists, err := projectDir.Exists()
	if err != nil {
		InternalError(w, req, log, err)
		return util.AbsolutePath{}, util.RelativePath{}, err
	}
	if !exists {
		err = errProjectDirNotFound
		NotFound(w, log, err)
		return util.AbsolutePath{}, util.RelativePath{}, err
	}
	// We will return a normalized version of the project directory
	relProjectDir, err := projectDir.Rel(base)
	if err != nil {
		InternalError(w, req, log, err)
		return util.AbsolutePath{}, util.RelativePath{}, err
	}
	return projectDir, relProjectDir, nil
}

func InterpretersFromRequest(
	base util.AbsolutePath,
	w http.ResponseWriter,
	req *http.Request,
	log logging.Logger,
) (
	interpreters.RInterpreter,
	interpreters.PythonInterpreter,
	error,
) {
	rExecutable := req.URL.Query().Get("r")
	rInterpreter, err := interpreters.NewRInterpreter(base, util.NewPath(rExecutable, nil), log, nil, nil, nil)
	if err != nil {
		InternalError(w, req, log, err)
		return nil, nil, err
	}
	pythonExecutable := req.URL.Query().Get("python")
	pythonInterpreter, err := interpreters.NewPythonInterpreter(base, util.NewPath(pythonExecutable, nil), log, nil, nil, nil)
	if err != nil {
		InternalError(w, req, log, err)
		return nil, nil, err
	}
	return rInterpreter, pythonInterpreter, nil
}
