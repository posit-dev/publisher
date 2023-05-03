package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type EntrypointSuite struct {
	utiltest.Suite
}

func TestEntrypointSuite(t *testing.T) {
	suite.Run(t, new(EntrypointSuite))
}

func (s *EntrypointSuite) TestInferEntrypointSpecifiedFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, "app.py", ".py", "app.py")
	s.Nil(err)
	s.Equal("app.py", entrypoint)
	s.Equal("app.py", filepath.Base(entrypointPath))
}

func (s *EntrypointSuite) TestInferEntrypointMatchingPreferredFileAndAnother() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)
	err = afero.WriteFile(fs, "mylib.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("app.py", entrypoint)
	s.Equal("app.py", filepath.Base(entrypointPath))
}

func (s *EntrypointSuite) TestInferEntrypointNonMatchingFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "app.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, "app.py", ".ipynb", "index.ipynb")
	s.Nil(err)
	s.Equal("", entrypoint)
	s.Equal("", entrypointPath)
}

func (s *EntrypointSuite) TestInferEntrypointOnlyMatchingFile() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "myapp.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("myapp.py", entrypoint)
	s.Equal("myapp.py", filepath.Base(entrypointPath))
}

func (s *EntrypointSuite) TestInferEntrypointMultipleMatchingFiles() {
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, "myapp.py", []byte{}, 0600)
	s.Nil(err)
	err = afero.WriteFile(fs, "mylib.py", []byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(fs, ".", ".py", "app.py")
	s.Nil(err)
	s.Equal("", entrypoint)
	s.Equal("", entrypointPath)
}

func (s *EntrypointSuite) TestFileHasPythonImports() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("import flask"), 0600)

	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestFileHasPythonImportsOpenErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Open")
	fs.On("Open", mock.Anything).Return(nil, testError)

	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.False(isFlask)
}

func (s *EntrypointSuite) TestHasPythonImports() {
	r := strings.NewReader("import flask")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestHasPythonImportsFrom() {
	r := strings.NewReader("from flask import api")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestHasPythonImportsSubpackage() {
	r := strings.NewReader("import flask.api")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestHasPythonImportsFromSubpackage() {
	r := strings.NewReader("from flask.api import foo")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestFileHasPythonImportsRelatedPackage() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("import flask_api"), 0600)
	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestFileHasPythonImportsFromRelatedPackage() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("from flask_api import foo"), 0600)
	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestHasPythonImportsNotPresent() {
	r := strings.NewReader("import dash")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.False(isFlask)
}

func (s *EntrypointSuite) TestHasPythonImportsMultiple() {
	r := strings.NewReader("import dash")
	h := defaultInferenceHelper{}
	isDash, err := h.HasPythonImports(r, []string{"dash_core_components", "dash"})
	s.Nil(err)
	s.True(isDash)
}

func (s *EntrypointSuite) TestHasPythonImportsReadErr() {
	r := utiltest.NewMockReader()
	testError := errors.New("test error from Read")
	r.On("Read", mock.Anything).Return(0, testError)
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{""})
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.False(isFlask)
}

func (s *EntrypointSuite) TestHasPythonImportsRegexpErr() {
	r := strings.NewReader("")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"("})
	s.NotNil(err)
	s.False(isFlask)
}
