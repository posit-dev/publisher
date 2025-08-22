package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/util/utiltest"
)

// Copyright (C) 2023 by Posit Software, PBC.

type FilesSuite struct {
	utiltest.Suite
}

func TestFilesSuite(t *testing.T) {
	suite.Run(t, new(FilesSuite))
}

func (s *FilesSuite) TestChdir() {
	initialWd, err := os.Getwd()
	s.Nil(err)
	parent := filepath.Dir(initialWd)
	wd, err := Chdir(parent)
	s.Nil(err)
	s.Equal(initialWd, wd)

	newWd, err := os.Getwd()
	s.Nil(err)
	s.Equal(parent, newWd)
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

func (s *FilesSuite) TestValidateFilename() {
	err := ValidateFilename(`hello there!`)
	s.NoError(err)
	err = ValidateFilename("")
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename(`.`)
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename(`..`)
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename(`here/../../elsewhere`)
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename(`hello/there!`)
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename(`hello\there!`)
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename(`hello? are you there?`)
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename("super nully\x00")
	s.ErrorIs(err, ErrInvalidName)
	err = ValidateFilename("you\tcant\rcontrol\nme")
	s.ErrorIs(err, ErrInvalidName)
}
