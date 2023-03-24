package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/spf13/afero"
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

type walker struct {
	fs         afero.Fs
	ignoreList gitignore.GitIgnoreList
}

func (i *walker) FS() afero.Fs {
	return i.fs
}

func (i *walker) Walk(path string, fn filepath.WalkFunc) error {
	return i.ignoreList.Walk(path, func(path string, info fs.FileInfo, err error) error {
		if info.IsDir() {
			// Load .rscignore from every directory where it exists
			ignorePath := filepath.Join(path, ".rscignore")
			err = i.ignoreList.Append(ignorePath)
			if errors.Is(err, fs.ErrNotExist) {
				err = nil
			}
			if err != nil {
				return fmt.Errorf("Error loading .rscignore file '%s': %w", ignorePath, err)
			}
			// Ignore Python environment directories. We check for these
			// separately because they aren't expressible as gitignore patterns.
			if isPythonEnvironmentDir(i.fs, path) {
				return filepath.SkipDir
			}
		}
		return fn(path, info, err)
	})
}

func (i *walker) addGlobs(globs []string) error {
	for _, pattern := range globs {
		err := i.ignoreList.AppendGlob(pattern)
		if err != nil {
			return err
		}
	}
	return nil
}

func NewWalker(fs afero.Fs, dir string, ignores []string) (Walker, error) {
	gitIgnore := gitignore.New(fs, dir)
	return newWalker(fs, dir, ignores, &gitIgnore)
}

func newWalker(fs afero.Fs, dir string, ignores []string, gitIgnore gitignore.GitIgnoreList) (Walker, error) {
	walk := &walker{
		fs:         fs,
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

var pythonBinPaths = []string{
	"bin/python",
	"bin/python3",
	"Scripts/python.exe",
	"Scripts/python3.exe",
}

func isPythonEnvironmentDir(fs afero.Fs, path string) bool {
	for _, binary := range pythonBinPaths {
		exists, err := afero.Exists(fs, filepath.Join(path, binary))
		if err == nil && exists {
			return true
		}
	}
	return false
}
