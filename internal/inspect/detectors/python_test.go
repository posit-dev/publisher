package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/schema"
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

func (s *PythonSuite) TestInferTypePreferredFilename() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "app.py"
	path := base.Join(filename)
	err = path.WriteFile([]byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonFlask,
		Entrypoint: filename,
		Validate:   true,
		Python:     &config.Python{},
	}, t)
}

func (s *PythonSuite) TestInferTypeAlternatePreferredFilename() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "main.py"
	err = base.Join(filename).WriteFile([]byte("import flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	// a distraction
	err = base.Join("random.py").WriteFile([]byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonFlask,
		Entrypoint: filename,
		Validate:   true,
		Python:     &config.Python{},
	}, t)
}

func (s *PythonSuite) TestInferTypeOnlyPythonFile() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "myapp.py"
	path := base.Join(filename)
	err = path.WriteFile([]byte("# import some stuffimport flask\napp = flask.Flask(__name__)\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonFlask,
		Entrypoint: filename,
		Validate:   true,
		Python:     &config.Python{},
	}, t)
}

func (s *PythonSuite) TestInferTypeNotFlask() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "app.py"
	path := base.Join(filename)
	err = path.WriteFile([]byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewFlaskDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Nil(t)
}

func (s *PythonSuite) TestInferTypeEntrypointErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, mock.Anything).Return("", util.AbsolutePath{}, testError)

	detector := NewFlaskDetector()
	detector.inferenceHelper = inferrer
	base, err := util.Getwd(utiltest.NewMockFs())
	s.NoError(err)

	t, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
	inferrer.AssertExpectations(s.T())
}

func (s *PythonSuite) TestInferTypeHasImportsErr() {
	inferrer := &MockInferenceHelper{}
	entrypoint := "app.py"
	entrypointPath, err := util.NewPath(entrypoint, nil).Abs()
	s.NoError(err)

	inferrer.On("InferEntrypoint", mock.Anything, ".py", mock.Anything).Return(entrypoint, entrypointPath, nil)
	testError := errors.New("test error from FileHasPythonImports")
	inferrer.On("FileHasPythonImports", mock.Anything, mock.Anything).Return(false, testError)

	detector := NewFlaskDetector()
	detector.inferenceHelper = inferrer
	base, err := util.Getwd(utiltest.NewMockFs())
	s.NoError(err)

	t, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
	inferrer.AssertExpectations(s.T())
}
