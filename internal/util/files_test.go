package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
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

	dir, err := DirFromPath(fs, "/my/dir")
	s.Nil(err)
	s.Equal("/my/dir", dir)
}

func (s *FilesSuite) TestDirFromPathDirErr() {
	fs := afero.NewMemMapFs()
	dir, err := DirFromPath(fs, "/nonexistent")
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Equal("", dir)
}
func (s *FilesSuite) TestDirFromPathFile() {
	fs := afero.NewMemMapFs()
	err := fs.MkdirAll("/my/dir", 0700)
	s.Nil(err)
	err = afero.WriteFile(fs, "/my/dir/app.py", nil, 0600)
	s.Nil(err)

	dir, err := DirFromPath(fs, "/my/dir/app.py")
	s.Nil(err)
	s.Equal("/my/dir", dir)
}

func (s *FilesSuite) TestChdir() {
	initialWd, err := os.Getwd()
	s.Nil(err)
	wd, err := Chdir("/")
	s.Nil(err)
	s.Equal(initialWd, wd)

	newWd, err := os.Getwd()
	s.Nil(err)
	s.Equal(newWd, "/")
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
