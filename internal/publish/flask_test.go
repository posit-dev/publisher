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

type FlaskDetectorSuite struct {
	utiltest.Suite
}

func TestFlaskDetectorSuite(t *testing.T) {
	suite.Run(t, new(FlaskDetectorSuite))
}

func (s *FlaskDetectorSuite) TestInferTypeSpecifiedFile() {
	filename := "myapp.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, filename)
	s.Nil(err)
	s.Equal(&ContentType{
		appMode:    apptypes.PythonAPIMode,
		entrypoint: filename,
		runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *FlaskDetectorSuite) TestInferTypePreferredFilename() {
	filename := "app.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		appMode:    apptypes.PythonAPIMode,
		entrypoint: filename,
		runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *FlaskDetectorSuite) TestInferTypeOnlyPythonFile() {
	filename := "myapp.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		appMode:    apptypes.PythonAPIMode,
		entrypoint: filename,
		runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *FlaskDetectorSuite) TestInferTypeNotFlask() {
	filename := "app.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Nil(t)
}

func (s *FlaskDetectorSuite) TestInferTypeEntrypointErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("", testError)

	detector := FlaskDetector{inferrer}
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}

func (s *FlaskDetectorSuite) TestInferTypeHasImportsErr() {
	inferrer := &MockInferenceHelper{}
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("app.py", nil)
	testError := errors.New("test error from FileHasPythonImports")
	inferrer.On("FileHasPythonImports", mock.Anything, mock.Anything, mock.Anything).Return(false, testError)

	detector := FlaskDetector{inferrer}
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}
