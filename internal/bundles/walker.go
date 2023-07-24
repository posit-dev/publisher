package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/util"
)

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

// excludingWalker is a Walker that excludes files and directories
// based on a combination of patterns sourced from:
//   - a built-in exclusion list
//   - caller-provided list (e.g. from the CLI)
//   - .gitignore files in the specified directory, subdirectories, and possibly parents.
//   - .rscignore files in the specified directory or subdirectories.

type excludingWalker struct {
	ignoreList gitignore.GitIgnoreList
}

func loadRscIgnoreIfPresent(dir util.Path, ignoreList gitignore.GitIgnoreList) error {
	ignorePath := dir.Join(".rscignore")
	err := ignoreList.Append(ignorePath)
	if errors.Is(err, fs.ErrNotExist) {
		err = nil
	}
	if err != nil {
		return fmt.Errorf("error loading .rscignore file '%s': %w", ignorePath, err)
	}
	return nil
}

func (i *excludingWalker) Walk(path util.Path, fn util.WalkFunc) error {
	return i.ignoreList.Walk(path, func(path util.Path, info fs.FileInfo, err error) error {
		if info.IsDir() {
			// Load .rscignore from every directory where it exists
			err = loadRscIgnoreIfPresent(path, i.ignoreList)
			if err != nil {
				return err
			}
			// Ignore Python environment directories. We check for these
			// separately because they aren't expressible as gitignore patterns.
			if util.IsPythonEnvironmentDir(path) {
				return filepath.SkipDir
			}
		}
		return fn(path, info, err)
	})
}

func (i *excludingWalker) addGlobs(globs []string) error {
	for _, pattern := range globs {
		err := i.ignoreList.AppendGlob(pattern)
		if err != nil {
			return err
		}
	}
	return nil
}

func NewExcludingWalker(dir util.Path, ignores []string) (util.Walker, error) {
	gitIgnore := gitignore.New(dir)
	return newExcludingWalker(dir, ignores, &gitIgnore)
}

func newExcludingWalker(dir util.Path, ignores []string, gitIgnore gitignore.GitIgnoreList) (util.Walker, error) {
	excluder := &excludingWalker{
		ignoreList: gitIgnore,
	}
	err := gitIgnore.AppendGit()
	if err != nil && err != gitignore.ErrNotInGitRepo {
		return nil, err
	}
	err = excluder.addGlobs(standardIgnores)
	if err != nil {
		return nil, err
	}
	err = excluder.addGlobs(ignores)
	if err != nil {
		return nil, err
	}
	return excluder, nil
}
