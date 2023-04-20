package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/publish/apptypes"
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
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, filename)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.PythonAPIMode,
		Entrypoint: filename,
		Runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *PythonSuite) TestInferTypePreferredFilename() {
	filename := "app.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.PythonAPIMode,
		Entrypoint: filename,
		Runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *PythonSuite) TestInferTypeOnlyPythonFile() {
	filename := "myapp.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("# import some stuffimport flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.PythonAPIMode,
		Entrypoint: filename,
		Runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *PythonSuite) TestInferTypeNotFlask() {
	filename := "app.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Nil(t)
}

func (s *PythonSuite) TestInferTypeEntrypointErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("", "", testError)

	detector := NewFlaskDetector()
	detector.inferenceHelper = inferrer
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}

func (s *PythonSuite) TestInferTypeHasImportsErr() {
	inferrer := &MockInferenceHelper{}
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("app.py", "app.py", nil)
	testError := errors.New("test error from FileHasPythonImports")
	inferrer.On("FileHasPythonImports", mock.Anything, mock.Anything, mock.Anything).Return(false, testError)

	detector := NewFlaskDetector()
	detector.inferenceHelper = inferrer
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}
