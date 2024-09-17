package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/services/api/files"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type cfgFromFile func(path util.AbsolutePath) (*config.Config, error)
type cfgGetConfigPath func(base util.AbsolutePath, configName string) util.AbsolutePath

// TODO: It would be better to have the config package methods as a provider pattern instead of plain functions
var configFromFile cfgFromFile = config.FromFile
var configGetConfigPath cfgGetConfigPath = config.GetConfigPath

func GetConfigFilesHandlerFunc(base util.AbsolutePath, filesService files.FilesService, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		configPath := configGetConfigPath(projectDir, name)
		cfg, err := configFromFile(configPath)
		if err != nil {
			if aerr, ok := err.(*types.AgentError); ok {
				if aerr.Code == types.ErrorUnknownTOMLKey {
					apiErr := APIErrorUnknownTOMLKeyFromAgentError(*aerr)
					apiErr.JSONResponse(w)
					return
				}

				if aerr.Code == types.ErrorInvalidTOML {
					apiErr := APIErrorInvalidTOMLFileFromAgentError(*aerr)
					apiErr.JSONResponse(w)
					return
				}
			}

			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, req)
			} else {
				InternalError(w, req, log, err)
			}
			return
		}
		matchList, err := matcher.NewMatchList(projectDir, matcher.StandardExclusions)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		err = matchList.AddFromFile(projectDir, configPath, cfg.Files)
		if err != nil {
			w.WriteHeader(http.StatusUnprocessableEntity)
			w.Write([]byte("invalid pattern in configuration 'files'"))
			return
		}

		file, err := filesService.GetFile(projectDir, matchList)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		JsonResult(w, file)
	}
}
