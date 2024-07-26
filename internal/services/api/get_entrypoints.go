package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"slices"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

func GetEntrypointsHandlerFunc(base util.AbsolutePath, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		projectDir, _, err := ProjectDirFromRequest(base, w, req, log)
		if err != nil {
			// Response already returned by ProjectDirFromRequest
			return
		}

		response := []string{}
		suffixes := []string{".htm", ".html", ".ipynb", ".py", ".qmd", ".R", ".Rmd"}
		files := []string{
			"*",
			"!**/renv/activate.R",
			"!**/_site/*.html",
			"**/_site/index.html",
			"!*_files",
		}

		walker, err := matcher.NewMatchingWalker(files, projectDir, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		err = walker.Walk(projectDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}
			if slices.Contains(suffixes, path.Ext()) {
				relPath, err := path.Rel(projectDir)
				if err != nil {
					return err
				}
				response = append(response, relPath.String())
			}
			return nil
		})
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
