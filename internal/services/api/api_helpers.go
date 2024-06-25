package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func InternalError(w http.ResponseWriter, req *http.Request, log logging.Logger, err error) {
	status := http.StatusInternalServerError
	text := http.StatusText(status)
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

var errProjectDirNotFound = errors.New("project directory not found")

// ProjectDirFromRequest returns the project directory from the request query parameter "dir".
// If the directory does not exist, it returns a 404.
// If the directory is not a subdirectory of the base directory, it returns a 400.
// Other errors return a 500.
func ProjectDirFromRequest(base util.AbsolutePath, w http.ResponseWriter, req *http.Request, log logging.Logger) (util.AbsolutePath, util.RelativePath, error) {
	dir := req.URL.Query().Get("dir")
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
