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

type Walker interface {
	Walk(path util.Path, fn util.WalkFunc) error
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

type bundlingWalker struct {
	ignoreList gitignore.GitIgnoreList
}

func (i *bundlingWalker) Walk(path util.Path, fn util.WalkFunc) error {
	return i.ignoreList.Walk(path, func(path util.Path, info fs.FileInfo, err error) error {
		if info.IsDir() {
			// Load .rscignore from every directory where it exists
			ignorePath := path.Join(".rscignore")
			err = i.ignoreList.Append(ignorePath)
			if errors.Is(err, fs.ErrNotExist) {
				err = nil
			}
			if err != nil {
				return fmt.Errorf("error loading .rscignore file '%s': %w", ignorePath, err)
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

func (i *bundlingWalker) addGlobs(globs []string) error {
	for _, pattern := range globs {
		err := i.ignoreList.AppendGlob(pattern)
		if err != nil {
			return err
		}
	}
	return nil
}

func NewBundlingWalker(dir util.Path, ignores []string) (Walker, error) {
	gitIgnore := gitignore.New(dir)
	return newBundlingWalker(dir, ignores, &gitIgnore)
}

func newBundlingWalker(dir util.Path, ignores []string, gitIgnore gitignore.GitIgnoreList) (Walker, error) {
	walk := &bundlingWalker{
		ignoreList: gitIgnore,
	}
	const errNotInGitRepo = "not in a git repository"
	err := gitIgnore.AppendGit()
	if err != nil && err.Error() != errNotInGitRepo {
		return nil, err
	}
	err = walk.addGlobs(standardIgnores)
	if err != nil {
		return nil, err
	}
	err = walk.addGlobs(ignores)
	if err != nil {
		return nil, err
	}
	return walk, nil
}
