package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/initialize"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type postInspectResponseBody struct {
	Configuration *config.Config `json:"configuration"`
	ProjectDir    string         `json:"projectDir"`
}

var errEntrypointNotFound = errors.New("entrypoint not found")

func getEntrypointPath(projectDir util.AbsolutePath, w http.ResponseWriter, req *http.Request, log logging.Logger) (util.RelativePath, error) {
	entrypoint := req.URL.Query().Get("entrypoint")
	if entrypoint == "" {
		return util.RelativePath{}, nil
	}
	entrypointPath, err := projectDir.SafeJoin(entrypoint)
	if err != nil {
		BadRequest(w, req, log, err)
		return util.RelativePath{}, err
	}
	exists, err := entrypointPath.Exists()
	if err != nil {
		InternalError(w, req, log, err)
		return util.RelativePath{}, err
	}
	if !exists {
		err = errEntrypointNotFound
		NotFound(w, log, err)
		return util.RelativePath{}, err
	}
	// Return a relative path version of the entrypoint
	relEntrypoint, err := entrypointPath.Rel(projectDir)
	if err != nil {
		InternalError(w, req, log, err)
		return util.RelativePath{}, err
	}
	return relEntrypoint, nil
}

type configGetter interface {
	GetPossibleConfigs(base util.AbsolutePath, python util.Path, rExecutable util.Path, entrypoint util.RelativePath, log logging.Logger) ([]*config.Config, error)
}

type postInspectHandler struct {
	base                util.AbsolutePath
	log                 logging.Logger
	initializer         configGetter
	matchingWalker      func([]string, util.AbsolutePath, logging.Logger) (util.Walker, error)
	interpretersResolve func(util.AbsolutePath, http.ResponseWriter, *http.Request, logging.Logger) (interpreters.RInterpreter, interpreters.PythonInterpreter, error)
}

func PostInspectHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	handler := &postInspectHandler{
		base:                base,
		log:                 log,
		initializer:         initialize.NewDefaultInitialize(),
		matchingWalker:      matcher.NewMatchingWalker,
		interpretersResolve: InterpretersFromRequest,
	}

	return handler.Handle
}

func (h *postInspectHandler) Handle(w http.ResponseWriter, req *http.Request) {
	projectDir, relProjectDir, err := ProjectDirFromRequest(h.base, w, req, h.log)
	if err != nil {
		// Response already returned by ProjectDirFromRequest
		return
	}

	// Parse and resolve executable paths for Python and R
	rInterpreter, pythonInterpreter, err := h.interpretersResolve(projectDir, w, req, h.log)
	if err != nil {
		// Response already returned by InterpretersFromRequest
		return
	}

	// At this point, it is ok if the system does not have R or Python interpreters.
	rPath, _ := rInterpreter.GetRExecutable()
	pythonPath, _ := pythonInterpreter.GetPythonExecutable()

	h.log.Debug("Python path to be used for inspection", "path", pythonPath.String())
	h.log.Debug("R path to be used for inspection", "path", rPath.String())

	response := []postInspectResponseBody{}

	if req.URL.Query().Get("recursive") == "true" {
		h.log.Debug("Recursive inspection intent found")
		walker, err := h.matchingWalker([]string{"*"}, projectDir, h.log)
		if err != nil {
			InternalError(w, req, h.log, err)
			return
		}

		h.log.Debug("Starting walk through directory", "directory", projectDir)
		err = walker.Walk(projectDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					return nil
				} else {
					return err
				}
			}
			if !info.IsDir() {
				return nil
			}
			if path.Base() == ".posit" {
				// no need to inspect or recurse into .posit directories
				return filepath.SkipDir
			}
			relProjectDir, err := path.Rel(h.base)
			if err != nil {
				return err
			}
			entrypoint := req.URL.Query().Get("entrypoint")
			entrypointPath := util.NewRelativePath(entrypoint, h.base.Fs())

			configs, err := h.initializer.GetPossibleConfigs(path, pythonPath.Path, rPath.Path, entrypointPath, h.log)
			if err != nil {
				return err
			}

			h.log.Debug("Possible configurations found for entrypoint", "path", entrypointPath.String(), "configs_len", len(configs))

			for _, cfg := range configs {
				if cfg.Type == contenttypes.ContentTypeUnknown {
					h.log.Debug("Unknown configuration found, skipping", "entrypoint", cfg.Entrypoint)
					continue
				}

				h.log.Debug("Including configuration result with response", "entrypoint", cfg.Entrypoint)

				response = append(response, postInspectResponseBody{
					ProjectDir:    relProjectDir.String(),
					Configuration: cfg,
				})
			}
			return nil
		})
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
	} else {
		entrypointPath, err := getEntrypointPath(projectDir, w, req, h.log)
		if err != nil {
			// Response already returned by getEntrypointPath
			return
		}

		configs, err := h.initializer.GetPossibleConfigs(projectDir, pythonPath.Path, rPath.Path, entrypointPath, h.log)
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

		h.log.Debug("Possible configurations found for entrypoint", "path", entrypointPath.String(), "configs_len", len(configs))

		response = make([]postInspectResponseBody, 0, len(configs))
		for _, cfg := range configs {
			h.log.Debug("Including configuration result with response", "entrypoint", cfg.Entrypoint)
			response = append(response, postInspectResponseBody{
				ProjectDir:    relProjectDir.String(),
				Configuration: cfg,
			})
		}
	}
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
