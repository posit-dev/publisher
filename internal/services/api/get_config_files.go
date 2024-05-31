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
		configPath := config.GetConfigPath(base, name)
		cfg, err := config.FromFile(configPath)
		if err != nil && errors.Is(err, fs.ErrNotExist) {
			http.NotFound(w, req)
			return
		}
		matchList, err := matcher.NewMatchList(base, matcher.StandardExclusions)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		err = matchList.AddFromFile(base, configPath, cfg.Files)
		if err != nil {
			w.WriteHeader(http.StatusUnprocessableEntity)
			w.Write([]byte("invalid pattern in configuration 'files'"))
			return
		}

		file, err := filesService.GetFile(base, matchList)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(file)
	}
}
