package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
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

func (s *PythonSuite) TestInferTypeSpecifiedFile() {
	filename := "myapp.py"
	path := util.NewPath(filename, afero.NewMemMapFs())
	err := path.WriteFile([]byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(path)
	s.Nil(err)
	s.Equal(&ContentType{
		Type:           config.ContentTypePythonFlask,
		Entrypoint:     filename,
		RequiresPython: true,
	}, t)
}

func (s *PythonSuite) TestInferTypePreferredFilename() {
	filename := "app.py"
	path := util.NewPath(filename, afero.NewMemMapFs())
	err := path.WriteFile([]byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(path)
	s.Nil(err)
	s.Equal(&ContentType{
		Type:           config.ContentTypePythonFlask,
		Entrypoint:     filename,
		RequiresPython: true,
	}, t)
}

func (s *PythonSuite) TestInferTypeAlternatePreferredFilename() {
	dir := util.NewPath("/", afero.NewMemMapFs())
	err := dir.MkdirAll(0777)
	s.NoError(err)

	filename := "main.py"
	err = dir.Join(filename).WriteFile([]byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	// a distraction
	err = dir.Join("random.py").WriteFile([]byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(dir)
	s.Nil(err)
	s.Equal(&ContentType{
		Type:           config.ContentTypePythonFlask,
		Entrypoint:     filename,
		RequiresPython: true,
	}, t)
}

func (s *PythonSuite) TestInferTypeOnlyPythonFile() {
	filename := "myapp.py"
	path := util.NewPath(filename, afero.NewMemMapFs())
	err := path.WriteFile([]byte("# import some stuffimport flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(path)
	s.Nil(err)
	s.Equal(&ContentType{
		Type:           config.ContentTypePythonFlask,
		Entrypoint:     filename,
		RequiresPython: true,
	}, t)
}

func (s *PythonSuite) TestInferTypeNotFlask() {
	filename := "app.py"
	path := util.NewPath(filename, afero.NewMemMapFs())
	err := path.WriteFile([]byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(path)
	s.Nil(err)
	s.Nil(t)
}

func (s *PythonSuite) TestInferTypeEntrypointErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything).Return("", util.Path{}, testError)

	detector := NewFlaskDetector()
	detector.inferenceHelper = inferrer
	path := util.NewPath(".", utiltest.NewMockFs())
	t, err := detector.InferType(path)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
	inferrer.AssertExpectations(s.T())
}

func (s *PythonSuite) TestInferTypeHasImportsErr() {
	inferrer := &MockInferenceHelper{}
	entrypoint := "app.py"
	entrypointPath := util.NewPath(entrypoint, nil)
	inferrer.On("InferEntrypoint", mock.Anything, ".py", mock.Anything).Return(entrypoint, entrypointPath, nil)
	testError := errors.New("test error from FileHasPythonImports")
	inferrer.On("FileHasPythonImports", mock.Anything, mock.Anything).Return(false, testError)

	detector := NewFlaskDetector()
	detector.inferenceHelper = inferrer
	path := util.NewPath(".", utiltest.NewMockFs())
	t, err := detector.InferType(path)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
	inferrer.AssertExpectations(s.T())
}
