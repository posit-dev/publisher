package files

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type FileTypesSuite struct {
	utiltest.Suite
}

func TestFileTypesSuite(t *testing.T) {
	suite.Run(t, new(FileTypesSuite))
}

type mockFileInfo struct {
	mock.Mock
	fs.FileInfo
}

func (m *mockFileInfo) Mode() fs.FileMode {
	args := m.Called()
	return args.Get(0).(fs.FileMode)
}

func (s *FileTypesSuite) TestMode0() {
	info := new(mockFileInfo)
	info.On("Mode").Return((fs.FileMode)(0))
	ft, err := getFileType(info)
	s.Nil(err)
	s.Equal(Regular, ft)
}

func (s *FileTypesSuite) TestModeDir() {
	info := new(mockFileInfo)
	info.On("Mode").Return(fs.ModeDir)
	ft, err := getFileType(info)
	s.Nil(err)
	s.Equal(Directory, ft)
}

func (s *FileTypesSuite) TestModeIrregular() {
	info := new(mockFileInfo)
	info.On("Mode").Return(fs.ModeIrregular)
	ft, err := getFileType(info)
	s.ErrorIs(err, ErrUnsupportedFileType)
	s.Equal(fileType(""), ft)
}

func (s *FileTypesSuite) TestModeSocket() {
	info := new(mockFileInfo)
	info.On("Mode").Return(fs.ModeSocket)
	ft, err := getFileType(info)
	s.ErrorIs(err, ErrUnsupportedFileType)
	s.Equal(fileType(""), ft)
}

func (s *FileTypesSuite) TestModeNamedPipe() {
	info := new(mockFileInfo)
	info.On("Mode").Return(fs.ModeNamedPipe)
	ft, err := getFileType(info)
	s.ErrorIs(err, ErrUnsupportedFileType)
	s.Equal(fileType(""), ft)
}
