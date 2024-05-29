package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonFlask,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
	}, configs[0])
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonFlask,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
	}, configs[0])
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonFlask,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
	}, configs[0])
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Nil(configs)
}

func (s *PythonSuite) TestInferTypeHasImportsErr() {
	base, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	err = base.MkdirAll(0777)
	s.NoError(err)

	err = base.Join("app.py").WriteFile(nil, 0600)
	s.NoError(err)

	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from FileHasPythonImports")
	inferrer.On("FileHasPythonImports", mock.Anything, mock.Anything).Return(false, testError)

	detector := NewFlaskDetector()
	detector.inferenceHelper = inferrer

	configs, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(configs)
	inferrer.AssertExpectations(s.T())
}
