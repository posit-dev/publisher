package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/util"
)

var StandardExclusions = []string{
	// From rsconnect-python
	".Rproj.user/",
	".git/",
	".svn/",
	"__pycache__/",
	"packrat/",
	"rsconnect-python/",
	"rsconnect/",

	// From rsconnect
	".DS_Store",
	".Rhistory",
	".quarto/",
	// Less precise than rsconnect, which checks for a
	// matching Rmd filename in the same directory.
	"*_cache/",

	// Other
	".ipynb_checkpoints/",

	// Exclude existing manifest.json; we will create one.
	"manifest.json",
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
		if info.IsDir() {
			// Ignore Python environment directories. We check for these
			// separately because they aren't expressible as gitignore patterns.
			if util.IsPythonEnvironmentDir(path) {
				return filepath.SkipDir
			}
		}
		return fn(path, info, err)
	})
}

// NewMatchingWalker returns a Walker that skips excluded files and directories.
// Exclusions are sourced from the built-in exclusions and the
// specified match list. Python environment directories are also excluded.
func NewMatchingWalker(dir util.AbsolutePath) util.Walker {
	patterns := append([]string{"/**"}, StandardExclusions...)
	matchList, err := NewMatchList(dir, patterns)
	if err != nil {
		panic("built-in exclusion list must compile successfully")
	}
	return &matchingWalker{
		matchList: matchList,
	}
}
