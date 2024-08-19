package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"slices"
	"strings"

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
		// lowercase versions of file extensions - considered equal to all case combinations
		suffixes := []string{".htm", ".html", ".ipynb", ".py", ".qmd", ".r", ".rmd"}
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
				if errors.Is(err, os.ErrNotExist) {
					return nil
				} else {
					return err
				}
			}
			if info.IsDir() {
				return nil
			}
			if slices.Contains(suffixes, strings.ToLower(path.Ext())) {
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
