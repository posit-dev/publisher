package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/util"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/iriri/minimal/gitignore"
)

type Walker interface {
	Walk(path string, fn filepath.WalkFunc) error
}

var standardIgnores = []string{
	// From rsconnect-python
	".Rproj.user/",
	".env/",
	".git/",
	".svn/",
	".venv/",
	"__pycache__/",
	"env/",
	"packrat/",
	// rsconnect was more precise in specifying renv/renv.lock
	// "renv/",
	"rsconnect-python/",
	"rsconnect/",
	"venv/",

	// From rsconnect
	".DS_Store",
	".gitignore",
	".Rhistory",
	"manifest.json",
	// "rsconnect",
	// "packrat",
	"app_cache/",
	// ".svn/",
	// ".git/",
	".quarto/",
	// ".Rproj.user/",
	"renv/renv.lock",
	// Less precise than rsconnect, which checks for a
	// matching Rmd filename in the same directory.
	"*_cache/",
}

type defaultWalker struct {
	ignoreList gitignore.IgnoreList
}

func (i *defaultWalker) Walk(path string, fn filepath.WalkFunc) error {
	return i.ignoreList.Walk(path, func(path string, info fs.FileInfo, err error) error {
		if info.IsDir() {
			// Load .rscignore from every directory where it exists
			ignorePath := filepath.Join(path, ".rscignore")
			err = i.ignoreList.Append(ignorePath)
			if os.IsNotExist(err) {
				err = nil
			}
			if err != nil {
				return fmt.Errorf("Error loading .rscignore file '%s': %s", ignorePath, err)
			}
			// Ignore Python environment directories. We check for these
			// separately because they aren't expressible as gitignore patterns.
			if isPythonEnvironmentDir(path) {
				return filepath.SkipDir
			}
		}
		return fn(path, info, err)
	})
}

func NewDefaultWalker(dir string, ignores []string) (Walker, error) {
	oldWD, err := util.Chdir(dir)
	if err != nil {
		return nil, err
	}
	defer util.Chdir(oldWD)

	ignore, err := gitignore.New()
	if err != nil {
		return nil, err
	}
	const errNotInGitRepo = "not in a git repository"
	err = ignore.AppendGit()
	if err != nil && err.Error() != errNotInGitRepo {
		return nil, err
	}
	for _, pattern := range standardIgnores {
		err = ignore.AppendGlob(pattern)
		if err != nil {
			return nil, err
		}
	}
	for _, pattern := range ignores {
		err = ignore.AppendGlob(pattern)
		if err != nil {
			return nil, err
		}
	}
	return &defaultWalker{
		ignoreList: ignore,
	}, nil
}

var pythonBinPaths = []string{
	"bin/python",
	"bin/python3",
	"Scripts/python.exe",
	"Scripts/python3.exe",
}

func isPythonEnvironmentDir(path string) bool {
	for _, binary := range pythonBinPaths {
		if util.Exists(filepath.Join(path, binary)) {
			return true
		}
	}
	return false
}
