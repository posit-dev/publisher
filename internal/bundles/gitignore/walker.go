package gitignore

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"

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
	ignoreList IgnoreList
}

const RscIgnoreFilename = ".rscignore"

// LoadRscIgnoreIfPresent loads the .rscignore file in the specified directory,
// if it exists, adding the exclusion rules to the specified ignore list.
func LoadRscIgnoreIfPresent(dir util.Path, ignoreList IgnoreList) error {
	ignorePath := dir.Join(RscIgnoreFilename)
	err := ignoreList.Append(ignorePath)
	if errors.Is(err, fs.ErrNotExist) {
		err = nil
	}
	if err != nil {
		return fmt.Errorf("error loading ignore file %q: %w", ignorePath, err)
	}
	return nil
}

// Walk traverses the directory at `path`, calling the specified function
// for every file and directory that does not match the exclusion list.
func (i *excludingWalker) Walk(path util.Path, fn util.WalkFunc) error {
	return i.ignoreList.Walk(path, func(path util.Path, info fs.FileInfo, err error) error {
		if info.IsDir() {
			// Load .rscignore from every directory where it exists
			err = LoadRscIgnoreIfPresent(path, i.ignoreList)
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

// NewExcludingWalker returns a Walker that skips excluded files and directories.
// Exclusions are sourced from the built-in exclusions, gitignore, and the
// specified ignore list. Python environment directories are also excluded,
// and .rscignore files are processed as they are encountered.
func NewExcludingWalker(dir util.Path, ignores []string) (util.Walker, error) {
	gitIgnore, err := NewIgnoreList(dir, ignores)
	if err != nil {
		return nil, err
	}
	return &excludingWalker{
		ignoreList: gitIgnore,
	}, nil
}

// NewIgnoreList returns an IgnoreList populated with the built-in
// exclusions, gitignore contents, and the provided ignore list.
func NewIgnoreList(dir util.Path, ignores []string) (IgnoreList, error) {
	gitIgnore := New(dir)
	//err := gitIgnore.AppendGit()
	// if err != nil && err != ErrNotInGitRepo {
	// 	return nil, err
	// }
	err := gitIgnore.AppendGlobs(standardIgnores, MatchSourceBuiltIn)
	if err != nil {
		return nil, err
	}
	err = gitIgnore.AppendGlobs(ignores, MatchSourceUser)
	if err != nil {
		return nil, err
	}
	return &gitIgnore, nil
}
