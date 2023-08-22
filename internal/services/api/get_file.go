package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/util"
)

func GetFileHandlerFunc(base util.Path, filesService files.FilesService, pathsService paths.PathsService, log *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p util.Path
		if q := r.URL.Query(); q.Has("pathname") {
			p = util.NewPath(q.Get("pathname"), base.Fs())
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

		file, err := filesService.GetFile(p)
		if err != nil {
			InternalError(w, r, log, err)
			return
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(file)
	}
}
