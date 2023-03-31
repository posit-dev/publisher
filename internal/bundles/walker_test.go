package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type WalkerSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd string
}

func TestWalkerSuite(t *testing.T) {
	suite.Run(t, new(WalkerSuite))
}

func (s *WalkerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := os.Getwd()
	s.Nil(err)
	s.cwd = cwd

	// Create a virtual version of the cwd so NewWalker
	// can Chdir there. This is needed because the
	// gitignore.IgnoreList uses relative paths internally
	// and expects to be able to call Abs on them.
	s.fs.MkdirAll(cwd, 0700)
}

func (s *WalkerSuite) TestNewWalker() {
	w, err := NewWalker(s.fs, s.cwd, []string{"*.log"})
	s.Nil(err)
	s.NotNil(w)
}

func (s *WalkerSuite) TestNewWalkerBadGitignore() {
	s.fs.Mkdir(filepath.Join(s.cwd, ".git"), 0700)
	giPath := filepath.Join(s.cwd, ".gitignore")
	data := []byte("[Z-A]\n")
	err := afero.WriteFile(s.fs, giPath, data, 0600)
	s.Nil(err)

	w, err := NewWalker(s.fs, s.cwd, nil)
	s.NotNil(err)
	s.Nil(w)
}

func (s *WalkerSuite) TestNewWalkerBadIgnore() {
	w, err := NewWalker(s.fs, s.cwd, []string{"[Z-A]"})
	s.NotNil(err)
	s.Nil(w)
}

func (s *WalkerSuite) TestIsPythonEnvironmentDir() {
	dir := filepath.Join(s.cwd, "testdir")
	s.fs.MkdirAll(filepath.Join(dir, "bin"), 0777)
	err := afero.WriteFile(s.fs, filepath.Join(dir, "bin", "python"), nil, 0777)
	s.Nil(err)
	s.True(isPythonEnvironmentDir(s.fs, dir))
}

func (s *WalkerSuite) TestIsPythonEnvironmentDirNoItIsnt() {
	s.False(isPythonEnvironmentDir(s.fs, s.cwd))
}

func (s *WalkerSuite) TestWalkErrorLoadingRscignore() {
	rscIgnorePath := filepath.Join(s.cwd, ".rscignore")
	err := afero.WriteFile(s.fs, rscIgnorePath, []byte("[Z-A]"), 0600)
	s.Nil(err)

	w, err := NewWalker(s.fs, s.cwd, nil)
	s.Nil(err)
	s.NotNil(w)

	err = w.Walk(s.cwd, func(path string, info fs.FileInfo, err error) error {
		return nil
	})
	s.ErrorContains(err, "Error loading .rscignore file")
}

func (s *WalkerSuite) TestWalk() {
	baseDir := filepath.Join(s.cwd, "test", "dir")

	// a Python env with a nonstandard name that contains bin/python
	envDir := filepath.Join(baseDir, "notnamedenv")
	err := s.fs.MkdirAll(filepath.Join(envDir, "bin"), 0777)
	s.Nil(err)
	err = afero.WriteFile(s.fs, filepath.Join(envDir, "bin", "python"), nil, 0777)
	s.Nil(err)

	// a dir excluded by .rscignore
	excludedDir := filepath.Join(baseDir, "excluded", "subdir")
	err = s.fs.MkdirAll(excludedDir, 0777)
	s.Nil(err)
	excludedFile := filepath.Join(excludedDir, "dontreadthis")
	err = afero.WriteFile(s.fs, excludedFile, []byte("this is an excluded file"), 0600)
	s.Nil(err)

	rscIgnorePath := filepath.Join(baseDir, ".rscignore")
	err = afero.WriteFile(s.fs, rscIgnorePath, []byte("excluded/\n*.csv\n"), 0600)
	s.Nil(err)

	// some files we want to include
	includedDir := filepath.Join(baseDir, "included")
	err = s.fs.MkdirAll(includedDir, 0777)
	s.Nil(err)
	includedFile := filepath.Join(includedDir, "includeme")
	err = afero.WriteFile(s.fs, includedFile, []byte("this is an included file"), 0600)
	s.Nil(err)

	// files excluded by .rscignore
	for i := 0; i < 3; i++ {
		csvPath := filepath.Join(includedDir, fmt.Sprintf("%d.csv", i))
		err = afero.WriteFile(s.fs, csvPath, nil, 0600)
		s.Nil(err)
	}

	w, err := NewWalker(s.fs, s.cwd, nil)
	s.Nil(err)
	s.NotNil(w)

	seen := []string{}
	err = w.Walk(baseDir, func(path string, info fs.FileInfo, err error) error {
		s.Nil(err)
		relPath, err := filepath.Rel(s.cwd, path)
		s.Nil(err)
		seen = append(seen, relPath)
		return nil
	})
	s.Nil(err)
	s.Equal([]string{
		"test/dir",
		"test/dir/.rscignore",
		"test/dir/included",
		"test/dir/included/includeme",
	}, seen)
}
