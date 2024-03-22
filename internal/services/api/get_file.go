package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/util"
)

func GetFileHandlerFunc(base util.AbsolutePath, filesService files.FilesService, pathsService paths.PathsService, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p util.AbsolutePath
		if q := r.URL.Query(); q.Has("pathname") {
			p = base.Join(q.Get("pathname"))
		} else {
			p = base
		}

		ok, err := pathsService.IsSafe(p)
		if err != nil {
			InternalError(w, r, log, err)
			return
		}

		// if pathname is not safe, return 403 - Forbidden
		if !ok {
			log.Warn("pathname is not safe", "path", p)
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(http.StatusText(http.StatusForbidden)))
			return
		}
		ignore := gitignore.NewIgnoreList(gitignore.StandardIgnores)

		file, err := filesService.GetFile(p, ignore)
		if err != nil {
			InternalError(w, r, log, err)
			return
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(file)
	}
}
