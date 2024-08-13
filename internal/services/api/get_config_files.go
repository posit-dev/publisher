package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/services/api/files"
	"github.com/posit-dev/publisher/internal/util"
)

func GetConfigFilesHandlerFunc(base util.AbsolutePath, filesService files.FilesService, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		name := mux.Vars(req)["name"]
		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}
		configPath := config.GetConfigPath(projectDir, name)
		cfg, err := config.FromFile(configPath)
		if err != nil {
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

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(file)
	}
}
