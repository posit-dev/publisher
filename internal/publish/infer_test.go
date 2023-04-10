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

type FlaskInfererSuite struct {
	utiltest.Suite
}

func TestFlaskInfererSuite(t *testing.T) {
	suite.Run(t, new(FlaskInfererSuite))
}

func (s *FlaskInfererSuite) TestFileHasPythonImports() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("import flask"), 0600)
	isFlask, err := fileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *FlaskInfererSuite) TestFileHasPythonImportsOpenErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Open")
	fs.On("Open", mock.Anything).Return(nil, testError)
	isFlask, err := fileHasPythonImports(fs, "test.py", []string{"flask"})
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.False(isFlask)
}

func (s *FlaskInfererSuite) TestHasPythonImports() {
	r := strings.NewReader("import flask")
	isFlask, err := hasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *FlaskInfererSuite) TestHasPythonImportsFrom() {
	r := strings.NewReader("from flask import api")
	isFlask, err := hasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *FlaskInfererSuite) TestHasPythonImportsSubpackage() {
	r := strings.NewReader("import flask.api")
	isFlask, err := hasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *FlaskInfererSuite) TestHasPythonImportsFromSubpackage() {
	r := strings.NewReader("from flask.api import foo")
	isFlask, err := hasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *FlaskInfererSuite) TestFileHasPythonImportsRelatedPackage() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("import flask_api"), 0600)
	isFlask, err := fileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *FlaskInfererSuite) TestFileHasPythonImportsFromRelatedPackage() {
	fs := afero.NewMemMapFs()
	afero.WriteFile(fs, "test.py", []byte("from flask_api import foo"), 0600)
	isFlask, err := fileHasPythonImports(fs, "test.py", []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *FlaskInfererSuite) TestHasPythonImportsNotPresent() {
	r := strings.NewReader("import dash")
	isFlask, err := hasPythonImports(r, []string{"flask"})
	s.Nil(err)
	s.False(isFlask)
}

func (s *FlaskInfererSuite) TestHasPythonImportsMultiple() {
	r := strings.NewReader("import dash")
	isDash, err := hasPythonImports(r, []string{"dash_core_components", "dash"})
	s.Nil(err)
	s.True(isDash)
}

func (s *FlaskInfererSuite) TestHasPythonImportsReadErr() {
	r := utiltest.NewMockReader()
	testError := errors.New("test error from Read")
	r.On("Read", mock.Anything).Return(0, testError)
	isFlask, err := hasPythonImports(r, []string{""})
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.False(isFlask)
}

func (s *FlaskInfererSuite) TestHasPythonImportsRegexpErr() {
	r := strings.NewReader("")
	isFlask, err := hasPythonImports(r, []string{"("})
	s.NotNil(err)
	s.False(isFlask)
}
