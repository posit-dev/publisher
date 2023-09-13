package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2023 by Posit Software, PBC.

type FilesSuite struct {
	utiltest.Suite
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) TestDirFromPathDir() {
	fs := afero.NewMemMapFs()
	err := fs.MkdirAll("/my/dir", 0700)
	s.Nil(err)

	path := NewPath("/my/dir", fs)
	dir, err := DirFromPath(path)
	s.Nil(err)
	s.Equal(path, dir)
}

func (s *FilesSuite) TestDirFromPathDirErr() {
	fs := afero.NewMemMapFs()
	path := NewPath("/nonexistent", fs)
	dir, err := DirFromPath(path)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Equal(Path{}, dir)
}

func (s *FilesSuite) TestDirFromPathFile() {
	fs := afero.NewMemMapFs()
	err := fs.MkdirAll("/my/dir", 0700)
	s.Nil(err)
	err = afero.WriteFile(fs, "/my/dir/app.py", nil, 0600)
	s.Nil(err)

	path := NewPath("/my/dir/app.py", fs)
	dir, err := DirFromPath(path)
	s.Nil(err)
	s.Equal(path.Dir(), dir)
}

func (s *FilesSuite) TestChdir() {
	initialWd, err := os.Getwd()
	s.Nil(err)
	wd, err := Chdir("/")
	s.Nil(err)
	s.Equal(initialWd, wd)

	newWd, err := os.Getwd()
	s.Nil(err)
	s.Equal("/", newWd)
}

func (s *FilesSuite) TestChdirNonexistent() {
	initialWd, err := os.Getwd()
	s.Nil(err)
	wd, err := Chdir("/nonexistent")
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Equal("", wd)

	newWd, err := os.Getwd()
	s.Nil(err)
	s.Equal(initialWd, newWd)
}

func (s *FilesSuite) TestIsPythonEnvironmentDir() {
	cwd, err := Getwd(afero.NewMemMapFs())
	s.Nil(err)
	dir := cwd.Join("testdir")
	dir.Join("bin").MkdirAll(0777)
	err = dir.Join("bin", "python").WriteFile(nil, 0777)
	s.Nil(err)
	s.True(IsPythonEnvironmentDir(dir))
}

func (s *FilesSuite) TestIsPythonEnvironmentDirNoItIsnt() {
	cwd, err := Getwd(afero.NewMemMapFs())
	s.Nil(err)
	s.False(IsPythonEnvironmentDir(cwd))
}
