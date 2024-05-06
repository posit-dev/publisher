package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/util"
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
}

// matchingWalker is a Walker that excludes files and directories
// based on a combination of patterns sourced from:
//   - caller-provided list (e.g. from a config file)
//   - a built-in exclusion list (of negative match patterns)
type matchingWalker struct {
	matchList MatchList
}

// Walk traverses the directory at `path`, calling the specified function
// for every file and directory that matches the match list.
func (i *matchingWalker) Walk(path util.AbsolutePath, fn util.AbsoluteWalkFunc) error {
	return i.matchList.Walk(path, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		m := i.matchList.Match(path)
		if m == nil || m.Exclude {
			if info.IsDir() {
				return filepath.SkipDir
			} else {
				return nil
			}
		}

		// Ignore Python environment directories. We check for these
		// separately because they aren't expressible as gitignore patterns.
		if info.IsDir() && (util.IsPythonEnvironmentDir(path) || util.IsRenvLibraryDir(path)) {
			return filepath.SkipDir
		}
		return fn(path, info, err)
	})
}

// NewMatchingWalker returns a Walker that only iterates over matching files and directories.
// All files are included, except exclusions sourced from the built-in exclusion list
// and Python environment directories.
func NewMatchingWalker(configuredMatches []string, dir util.AbsolutePath) (util.Walker, error) {
	patterns := append(configuredMatches, StandardExclusions...)
	matchList, err := NewMatchList(dir, patterns)
	if err != nil {
		return nil, err
	}
	return &matchingWalker{
		matchList: matchList,
	}, nil
}
