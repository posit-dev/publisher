package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/util"
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

func (s *EntrypointSuite) TestInferEntrypointMatchingPreferredFileAndAnother() {
	base := util.NewPath(".", afero.NewMemMapFs())
	err := base.Join("app.py").WriteFile([]byte{}, 0600)
	s.Nil(err)
	err = base.Join("mylib.py").WriteFile([]byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(base, ".py", "app.py")
	s.Nil(err)
	s.Equal("app.py", entrypoint)
	s.Equal("app.py", entrypointPath.Base())
}

func (s *EntrypointSuite) TestInferEntrypointAlternatePreferredFileAndAnother() {
	base := util.NewPath(".", afero.NewMemMapFs())
	err := base.Join("main.py").WriteFile([]byte{}, 0600)
	s.Nil(err)
	err = base.Join("mylib.py").WriteFile([]byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(base, ".py", "app.py", "main.py")
	s.Nil(err)
	s.Equal("main.py", entrypoint)
	s.Equal("main.py", entrypointPath.Base())
}

func (s *EntrypointSuite) TestInferEntrypointNonMatchingFile() {
	base := util.NewPath(".", afero.NewMemMapFs())
	path := base.Join("app.py")
	err := path.WriteFile([]byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(base, ".ipynb", "index.ipynb")
	s.Nil(err)
	s.Equal("", entrypoint)
	s.Equal(util.Path{}, entrypointPath)
}

func (s *EntrypointSuite) TestInferEntrypointOnlyMatchingFile() {
	base := util.NewPath(".", afero.NewMemMapFs())
	err := base.Join("myapp.py").WriteFile([]byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(base, ".py", "app.py")
	s.Nil(err)
	s.Equal("myapp.py", entrypoint)
	s.Equal("myapp.py", entrypointPath.Base())
}

func (s *EntrypointSuite) TestInferEntrypointMultipleMatchingFiles() {
	// Multiple possible files, none of which is preferred.
	base := util.NewPath(".", afero.NewMemMapFs())
	err := base.Join("mylib.py").WriteFile([]byte{}, 0600)
	s.Nil(err)
	err = base.Join("myapp.py").WriteFile([]byte{}, 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	entrypoint, entrypointPath, err := h.InferEntrypoint(base, ".py", "app.py")
	s.Nil(err)
	s.Equal("myapp.py", entrypoint)
	s.Equal(base.Join("myapp.py"), entrypointPath)
}

func (s *EntrypointSuite) TestFileHasPythonImports() {
	path := util.NewPath("test.py", afero.NewMemMapFs())
	err := path.WriteFile([]byte("import flask"), 0600)
	s.Nil(err)

	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(path, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestFileHasPythonImportsOpenErr() {
	fs := utiltest.NewMockFs()
	testError := errors.New("test error from Open")
	fs.On("Open", mock.Anything).Return(nil, testError)

	h := defaultInferenceHelper{}
	path := util.NewPath("test.py", fs)
	isFlask, err := h.FileHasPythonImports(path, []string{"flask"})
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.False(isFlask)
	fs.AssertExpectations(s.T())
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
	path := util.NewPath("test.py", afero.NewMemMapFs())
	err := path.WriteFile([]byte("import flask_api"), 0600)
	s.Nil(err)
	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(path, []string{"flask"})
	s.Nil(err)
	s.True(isFlask)
}

func (s *EntrypointSuite) TestFileHasPythonImportsFromRelatedPackage() {
	path := util.NewPath("test.py", afero.NewMemMapFs())
	err := path.WriteFile([]byte("from flask_api import foo"), 0600)
	s.Nil(err)
	h := defaultInferenceHelper{}
	isFlask, err := h.FileHasPythonImports(path, []string{"flask"})
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
	r.AssertExpectations(s.T())
}

func (s *EntrypointSuite) TestHasPythonImportsRegexpErr() {
	r := strings.NewReader("")
	h := defaultInferenceHelper{}
	isFlask, err := h.HasPythonImports(r, []string{"("})
	s.NotNil(err)
	s.False(isFlask)
}
