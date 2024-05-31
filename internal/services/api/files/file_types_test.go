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
	var path string = "path"
	info := new(mockFileInfo)
	info.On("Mode").Return((fs.FileMode)(0))
	ft, err := getFileType(path, info)
	s.Nil(err)
	s.Equal(Regular, ft)
}

func (s *FileTypesSuite) TestModeDir() {
	var path string = "path"
	info := new(mockFileInfo)
	info.On("Mode").Return(fs.ModeDir)
	ft, err := getFileType(path, info)
	s.Nil(err)
	s.Equal(Directory, ft)
}

func (s *FileTypesSuite) TestModeIrregular() {
	var path string = "path"
	info := new(mockFileInfo)
	info.On("Mode").Return(fs.ModeIrregular)
	ft, err := getFileType(path, info)
	s.Error(err)
	s.Equal(fileType(""), ft)
}
