package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

var StandardExclusions = []string{
	// From rsconnect-python
	"!.Rproj.user/",
	"!.git/",
	"!.svn/",
	"!__pycache__/",
	"!packrat/",
	"!rsconnect-python/",
	"!rsconnect/",

	// From rsconnect
	"!.DS_Store",
	"!.Rhistory",
	"!.quarto/",
	// Less precise than rsconnect, which checks for a
	// matching Rmd filename in the same directory.
	"!*_cache/",

	// Other
	"!.ipynb_checkpoints/",

	// Exclude existing manifest.json; we will create one.
	"!manifest.json",

	// renv library cannot be included; Connect doesn't need it
	// and it's probably the wrong platform anyway.
	"!renv/library",
	"!renv/sandbox",
	"!renv/staging",

	// node_modules shouldn't be deployed and can be very large
	"!node_modules/",
}

// matchingWalker is a Walker that excludes files and directories
// based on a combination of patterns sourced from:
//   - caller-provided list (e.g. from a config file)
//   - a built-in exclusion list (of negative match patterns)
type matchingWalker struct {
	matchList MatchList
	log       logging.Logger
}

// Walk traverses the directory at `path`, calling the specified function
// for every file and directory that matches the match list.
func (i *matchingWalker) Walk(base util.AbsolutePath, fn util.AbsoluteWalkFunc) error {
	return base.Walk(func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		if path != base {
			m := i.matchList.Match(path)
			if info.IsDir() {
				// If there was not an explicit exclusion, we need to
				// traverse the directory to see if any patterns match
				// within it.
				if m != nil && m.Exclude {
					i.log.Debug("excluding directory", "path", path)
					return filepath.SkipDir
				}
				// Ignore Python environment directories. We check for these
				// separately because they aren't expressible as gitignore patterns.
				if util.IsPythonEnvironmentDir(path) || util.IsRenvLibraryDir(path) {
					i.log.Debug("excluding library dir", "path", path)
					return filepath.SkipDir
				}
			} else {
				if m == nil || m.Exclude {
					return nil
				}
			}
		}
		if errors.Is(err, os.ErrPermission) {
			i.log.Warn("permission error; skipping", "path", path)
			return nil
		}
		if err != nil {
			i.log.Warn("Unknown error while accessing file", "path", path, "error", err.Error())
			return nil
		}
		return fn(path, info, err)
	})
}

// NewMatchingWalker returns a Walker that only iterates over matching files and directories.
// All files are included, except exclusions sourced from the built-in exclusion list
// and Python environment directories.
func NewMatchingWalker(configuredMatches []string, dir util.AbsolutePath, log logging.Logger) (util.Walker, error) {
	patterns := append(configuredMatches, StandardExclusions...)
	matchList, err := NewMatchList(dir, patterns)
	if err != nil {
		return nil, err
	}
	return &matchingWalker{
		matchList: matchList,
		log:       log,
	}, nil
}
