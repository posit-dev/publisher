package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type SymlinkWalkerSuite struct {
	utiltest.Suite

	fs  afero.Fs
	cwd Path
}

func TestSymlinkWalkerSuite(t *testing.T) {
	suite.Run(t, new(SymlinkWalkerSuite))
}

func (s *SymlinkWalkerSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	_, filename, _, ok := runtime.Caller(0)
	s.True(ok)
	s.cwd = NewPath(filepath.Dir(filename), s.fs)
}

func (s *SymlinkWalkerSuite) makeFile(path string) {
	s.makeFileWithContents(path, []byte("content of "+path))
}

func (s *SymlinkWalkerSuite) makeFileWithContents(relPath string, contents []byte) {
	path := s.cwd.Join(relPath)
	err := path.Dir().MkdirAll(0700)
	s.Nil(err)

	err = path.WriteFile(contents, 0600)
	s.Nil(err)
}

func (s *SymlinkWalkerSuite) TestWalkNoSymlinks() {
	s.makeFile("testfile")
	s.makeFile(filepath.Join("subdir", "testfile"))

	underlyingWalker := &FSWalker{}
	logger := rslog.NewDiscardingLogger()
	walker := NewSymlinkWalker(underlyingWalker, logger)
	sourcePath := s.cwd.Join("subdir")
	fileList := []string{}

	err := walker.Walk(sourcePath, func(path Path, info fs.FileInfo, err error) error {
		s.Nil(err)
		fileList = append(fileList, path.Base())
		return nil
	})
	s.Nil(err)
	sort.Strings(fileList)
	s.Equal([]string{
		"subdir",
		"testfile",
	}, fileList)
}

func (s *SymlinkWalkerSuite) TestWalkError() {
	badFS := utiltest.NewMockFs()
	testError := errors.New("error from Stat")
	badFS.On("Stat", mock.Anything).Return(utiltest.NewMockFileInfo(), testError)

	underlyingWalker := &FSWalker{}
	logger := rslog.NewDiscardingLogger()
	walker := NewSymlinkWalker(underlyingWalker, logger)
	sourcePath := NewPath(".", badFS)
	err := walker.Walk(sourcePath, func(path Path, info fs.FileInfo, err error) error {
		return err
	})
	s.ErrorIs(err, testError)
}

func (s *SymlinkWalkerSuite) TestNewBundleFromDirectorySymlinks() {
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	realFS := afero.NewOsFs()
	sourcePath := NewPath(s.cwd.Path(), realFS).Join("testdata", "symlink_test", "bundle_dir")
	logger := rslog.NewDiscardingLogger()

	underlyingWalker := &FSWalker{}
	walker := NewSymlinkWalker(underlyingWalker, logger)
	fileList := []string{}

	err := walker.Walk(sourcePath, func(path Path, info fs.FileInfo, err error) error {
		s.Nil(err)
		fileList = append(fileList, path.Base())
		return nil
	})
	s.Nil(err)
	sort.Strings(fileList)
	s.Equal([]string{
		"bundle_dir",
		"linked_dir",
		"linked_file",
		"somefile",
		"testfile",
	}, fileList)
}

func (s *SymlinkWalkerSuite) TestNewBundleFromDirectoryMissingSymlinkTarget() {
	// afero's MemFs doesn't have symlink support, so we
	// are using a fixture directory under ./testdata.
	realFS := afero.NewOsFs()
	dirPath := NewPath(s.cwd.Path(), realFS).Join("testdata", "symlink_test", "link_target_missing")
	logger := rslog.NewDiscardingLogger()

	underlyingWalker := &FSWalker{}
	walker := NewSymlinkWalker(underlyingWalker, logger)
	err := walker.Walk(dirPath, func(path Path, info fs.FileInfo, err error) error {
		return nil
	})
	s.ErrorIs(err, os.ErrNotExist)
}
