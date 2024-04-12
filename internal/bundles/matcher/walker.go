package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/util"
)

var StandardIgnores = []string{
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
	".posit/publish/deployments/**/v*",

	// Exclude existing manifest.json; we will create one.
	"manifest.json",
}

// excludingWalker is a Walker that excludes files and directories
// based on a combination of patterns sourced from:
//   - a built-in exclusion list
//   - caller-provided list (e.g. from a config file)
type excludingWalker struct {
	ignoreList IgnoreList
}

// Walk traverses the directory at `path`, calling the specified function
// for every file and directory that does not match the exclusion list.
func (i *excludingWalker) Walk(path util.AbsolutePath, fn util.AbsoluteWalkFunc) error {
	return i.ignoreList.Walk(path, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
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

// NewExcludingWalker returns a Walker that skips excluded files and directories.
// Exclusions are sourced from the built-in exclusions and the
// specified ignore list. Python environment directories are also excluded.
func NewExcludingWalker(dir util.AbsolutePath) util.Walker {
	gitIgnore, err := NewIgnoreList(dir, StandardIgnores)
	if err != nil {
		panic("built-in ignore list must compile successfully")
	}
	return &excludingWalker{
		ignoreList: gitIgnore,
	}
}
