package matcher

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type WalkerSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd util.AbsolutePath
}

func TestWalkerSuite(t *testing.T) {
	suite.Run(t, new(WalkerSuite))
}

func (s *WalkerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd

	// Create a virtual version of the cwd so NewWalker
	// can Chdir there. This is needed because the
	// matcher.MatchList uses relative paths internally
	// and expects to be able to call Abs on them.
	cwd.MkdirAll(0700)
}

func (s *WalkerSuite) TestNewMatchingWalker() {
	w, err := NewMatchingWalker(nil, s.cwd, logging.New())
	s.NoError(err)
	s.NotNil(w)
}

func (s *WalkerSuite) TestWalk() {
	baseDir := s.cwd.Join("test", "dir")

	// a Python env with a nonstandard name that contains bin/python
	envDir := baseDir.Join("notnamedenv")
	err := envDir.Join("bin").MkdirAll(0777)
	s.NoError(err)
	err = envDir.Join("bin", "python").WriteFile(nil, 0777)
	s.NoError(err)

	// some files we want to include
	includedDir := baseDir.Join("included")
	err = includedDir.MkdirAll(0777)
	s.NoError(err)

	includedFile := includedDir.Join("includeme")
	err = includedFile.WriteFile([]byte("this is an included file"), 0600)
	s.NoError(err)

	// This will be excluded by default
	err = baseDir.Join("manifest.json").WriteFile(nil, 0777)
	s.NoError(err)

	renvLibDir := baseDir.Join("renv", "library")
	err = renvLibDir.MkdirAll(0777)
	s.NoError(err)
	err = renvLibDir.Join("foo").WriteFile(nil, 0777)
	s.NoError(err)

	renvStagingDir := baseDir.Join("renv", "staging")
	err = renvLibDir.MkdirAll(0777)
	s.NoError(err)
	err = renvStagingDir.Join("foo").WriteFile(nil, 0777)
	s.NoError(err)

	renvSandboxDir := baseDir.Join("renv", "sandbox")
	err = renvLibDir.MkdirAll(0777)
	s.NoError(err)
	err = renvSandboxDir.Join("foo").WriteFile(nil, 0777)
	s.NoError(err)

	w, err := NewMatchingWalker([]string{"*"}, s.cwd, logging.New())
	s.NoError(err)
	s.NotNil(w)

	seen := []string{}
	err = w.Walk(baseDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		s.NoError(err)
		relPath, err := path.Rel(s.cwd)
		s.NoError(err)
		seen = append(seen, relPath.String())
		return nil
	})
	s.NoError(err)
	dirPath := util.NewRelativePath("test", s.fs).Join("dir")
	s.Equal([]string{
		dirPath.String(),
		dirPath.Join("included").String(),
		dirPath.Join("included", "includeme").String(),
		dirPath.Join("renv").String(),
	}, seen)
}

func (s *WalkerSuite) TestWalkPermissionErr() {
	afs := utiltest.NewMockFs()
	baseDir := s.cwd.WithFs(afs)

	// We can't traverse this directory because of permissions
	afs.On("Open", baseDir.String()).Return(nil, os.ErrPermission)

	// We can stat it though; fake with fileInfo from the real directory
	fileInfo, err := s.cwd.Stat()
	s.NoError(err)
	afs.On("Stat", baseDir.String()).Return(fileInfo, nil)

	w, err := NewMatchingWalker([]string{"*"}, s.cwd, logging.New())
	s.NoError(err)
	s.NotNil(w)

	seen := []string{}
	err = w.Walk(baseDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		s.NoError(err)
		relPath, err := path.Rel(s.cwd)
		s.NoError(err)
		seen = append(seen, relPath.String())
		return nil
	})
	s.NoError(err)
	s.Equal([]string{"."}, seen)
}

func (s *WalkerSuite) TestWalkErr_Logged() {
	// Errors while walking through files are logged but won't halt the current process
	afs := utiltest.NewMockFs()
	baseDir := s.cwd.WithFs(afs)

	fileInfo, err := s.cwd.Stat()
	s.NoError(err)
	afs.On("Stat", baseDir.String()).Return(fileInfo, errors.New("batteries not included"))

	log := loggingtest.NewMockLogger()
	log.On("Warn", "Unknown error while accessing file", "path", mock.Anything, "error", mock.Anything).Return()

	w, err := NewMatchingWalker([]string{"*"}, s.cwd, log)
	s.NoError(err)
	s.NotNil(w)

	err = w.Walk(baseDir, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		s.NoError(err)
		return nil
	})
	s.NoError(err)
	log.AssertExpectations(s.T())
}

func (s *WalkerSuite) TestWalkSubdirectory() {
	baseDir := s.cwd.Join("test", "dir")
	err := baseDir.MkdirAll(0777)
	s.NoError(err)

	err = baseDir.Join("app.py").WriteFile(nil, 0666)
	s.NoError(err)

	w, err := NewMatchingWalker([]string{"*.py"}, s.cwd, logging.New())
	s.NoError(err)

	seen := []string{}
	err = w.Walk(s.cwd, func(path util.AbsolutePath, info fs.FileInfo, err error) error {
		s.NoError(err)
		relPath, err := path.Rel(s.cwd)
		s.NoError(err)
		seen = append(seen, relPath.String())
		return nil
	})
	s.NoError(err)
	s.Equal([]string{
		".",
		filepath.Join(".", "test"),
		filepath.Join(".", "test", "dir"),
		filepath.Join(".", "test", "dir", "app.py"),
	}, seen)
}
