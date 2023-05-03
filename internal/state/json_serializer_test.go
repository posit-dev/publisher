package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type JsonSerializerSuite struct {
	utiltest.Suite
}

func TestJsonSerializerSuite(t *testing.T) {
	suite.Run(t, new(JsonSerializerSuite))
}

func (s *JsonSerializerSuite) TestNewJsonSerializer() {
	fs := utiltest.NewMockFs()
	logger := rslog.NewDiscardingLogger()
	serializer := newJsonSerializer(fs, "/my/path", logger)
	expected := &jsonSerializer{
		fs:     fs,
		dir:    "/my/path",
		logger: logger,
	}
	s.Equal(expected, serializer)
}

type testData struct {
	Foo int    `json:"foo"`
	Bar string `json:"bar"`
}

func (s *JsonSerializerSuite) TestSaveLoad() {
	fs := afero.NewMemMapFs()
	logger := rslog.NewDiscardingLogger()
	serializer := newJsonSerializer(fs, "/my/path", logger)
	data := testData{
		Foo: 1,
		Bar: "hi there",
	}
	err := serializer.Save("test", &data)
	s.Nil(err)
	var loadedData testData
	err = serializer.Load("test", &loadedData)
	s.Nil(err)
	s.Equal(data, loadedData)
}

func (s *JsonSerializerSuite) TestLoadMissingFile() {
	fs := afero.NewMemMapFs()
	logger := rslog.NewDiscardingLogger()
	serializer := newJsonSerializer(fs, "/my/path", logger)
	var loadedData testData
	err := serializer.Load("test", &loadedData)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
}

func (s *JsonSerializerSuite) TestLoadBadJSON() {
	dir := "/my/path"
	fs := afero.NewMemMapFs()
	err := fs.MkdirAll(dir, 0700)
	s.Nil(err)
	err = afero.WriteFile(fs, filepath.Join(dir, "test.json"), []byte(""), 0600)
	s.Nil(err)

	logger := rslog.NewDiscardingLogger()
	serializer := newJsonSerializer(fs, dir, logger)
	var loadedData testData
	err = serializer.Load("test", &loadedData)
	s.NotNil(err)
	s.ErrorContains(err, "Cannot parse JSON")
	s.ErrorContains(err, "test.json")
}

func (s *JsonSerializerSuite) TestSaveCreateErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Create")
	fs.On("Create", mock.Anything).Return(nil, testError)
	logger := rslog.NewDiscardingLogger()
	serializer := newJsonSerializer(fs, "/my/path", logger)
	var data testData
	err := serializer.Save("test", &data)
	s.NotNil(err)
	s.ErrorIs(err, testError)
}

func (s *JsonSerializerSuite) TestSaveWriteErr() {
	fs := utiltest.NewMockFs()
	f := utiltest.NewMockFile()
	fs.On("Create", mock.Anything).Return(f, nil)
	testError := errors.New("test error from Write")
	f.On("Write", mock.Anything).Return(0, testError)
	f.On("Close").Return(nil)

	logger := rslog.NewDiscardingLogger()
	serializer := newJsonSerializer(fs, "/my/path", logger)
	var data testData
	err := serializer.Save("test", &data)
	s.NotNil(err)
	s.ErrorIs(err, testError)
}
