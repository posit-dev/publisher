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

type FastAPIDetectorSuite struct {
	utiltest.Suite
}

func TestFastAPIDetectorSuite(t *testing.T) {
	suite.Run(t, new(FastAPIDetectorSuite))
}

func (s *FastAPIDetectorSuite) TestInferTypeSpecifiedFile() {
	filename := "myapp.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import fastapi\napp = fastapi.FastAPI()\n"), 0600)
	s.Nil(err)

	detector := NewFastAPIDetector()
	t, err := detector.InferType(fs, filename)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.PythonFastAPIMode,
		Entrypoint: filename,
		Runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *FastAPIDetectorSuite) TestInferTypePreferredFilename() {
	filename := "app.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import fastapi\napp = fastapi.FastAPI()\n"), 0600)
	s.Nil(err)

	detector := NewFastAPIDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.PythonFastAPIMode,
		Entrypoint: filename,
		Runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *FastAPIDetectorSuite) TestInferTypeOnlyPythonFile() {
	filename := "myapp.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import fastapi\napp = fastapi.FastAPI()\n"), 0600)
	s.Nil(err)

	detector := NewFastAPIDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.PythonFastAPIMode,
		Entrypoint: filename,
		Runtimes:   []Runtime{PythonRuntime},
	}, t)
}

func (s *FastAPIDetectorSuite) TestInferTypeNotFastAPI() {
	filename := "app.py"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewFastAPIDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Nil(t)
}

func (s *FastAPIDetectorSuite) TestInferTypeEntrypointErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("", "", testError)

	detector := FastAPIDetector{inferrer}
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}

func (s *FastAPIDetectorSuite) TestInferTypeHasImportsErr() {
	inferrer := &MockInferenceHelper{}
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("app.py", "app.py", nil)
	testError := errors.New("test error from FileHasPythonImports")
	inferrer.On("FileHasPythonImports", mock.Anything, mock.Anything, mock.Anything).Return(false, testError)

	detector := FastAPIDetector{inferrer}
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}
