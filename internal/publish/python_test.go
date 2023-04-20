package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PythonSuite struct {
	utiltest.Suite
}

func TestPythonSuite(t *testing.T) {
	suite.Run(t, new(PythonSuite))
}

func (s *PythonSuite) TestFileHasPythonImports() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("import flask"), 0600)

	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *PythonSuite) TestFileHasPythonImportsOpenErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Open")
	fs.On("Open", mock.Anything).Return(nil, testError)

	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.False(isFlask)
}

func (s *PythonSuite) TestHasPythonImports() {
	r := strings.NewReader("import flask")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *PythonSuite) TestHasPythonImportsFrom() {
	r := strings.NewReader("from flask import api")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *PythonSuite) TestHasPythonImportsSubpackage() {
	r := strings.NewReader("import flask.api")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *PythonSuite) TestHasPythonImportsFromSubpackage() {
	r := strings.NewReader("from flask.api import foo")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *PythonSuite) TestFileHasPythonImportsRelatedPackage() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("import flask_api"), 0600)
	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *PythonSuite) TestFileHasPythonImportsFromRelatedPackage() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("from flask_api import foo"), 0600)
	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *PythonSuite) TestHasPythonImportsNotPresent() {
	r := strings.NewReader("import dash")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.False(isFlask)
}

func (s *PythonSuite) TestHasPythonImportsMultiple() {
	r := strings.NewReader("import dash")
	h := defaultInferenceHelper{}
	isDash, err := h.HasPythonImports(r, []string{"dash_core_components", "dash"})
	s.Nil(err)
	s.True(isDash)
}

func (s *PythonSuite) TestHasPythonImportsReadErr() {
	r := utiltest.NewMockReader()
	testError := errors.New("test error from Read")
	r.On("Read", mock.Anything).Return(0, testError)
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{""})
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.False(isFlask)
}

func (s *PythonSuite) TestHasPythonImportsRegexpErr() {
	r := strings.NewReader("")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"("})
	s.NotNil(err)
	s.False(isFlask)
}
