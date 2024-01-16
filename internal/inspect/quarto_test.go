package inspect

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

type QuartoDetectorSuite struct {
	utiltest.Suite
}

func TestQuartoDetectorSuite(t *testing.T) {
	suite.Run(t, new(QuartoDetectorSuite))
}

func (s *QuartoDetectorSuite) TestInferTypePreferredFilename() {
	base := util.NewPath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "project.qmd"
	path := base.Join(filename)
	err = path.Join(filename).WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()
	executor := utiltest.NewMockExecutor()
	executor.On("RunCommand", "quarto", []string{"inspect", "/project"}).Return([]byte(`{
		"quarto": {
			"version": "1.3.353"
		  },
		  "dir": "/project",
		  "engines": [
			"markdown"
		  ],
		  "config": {
			"project": {
			  "title": "this is the title"
			},
			"editor": "visual",
			"language": {}
		  },
		  "files": {
			"input": [
			  "/project/project.qmd"
			],
			"resources": [],
			"config": [
			  "/project/_quarto.yml"
			],
			"configResources": []
		  }
	}`), nil)
	detector.executor = executor

	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: filename,
		Title:      "this is the title",
		Validate:   true,
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"markdown"},
		},
	}, t)
}

func (s *QuartoDetectorSuite) TestInferTypeWithPython() {
	base := util.NewPath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "project.qmd"
	path := base.Join(filename)
	err = path.Join(filename).WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()
	executor := utiltest.NewMockExecutor()
	out := []byte(`{
		"quarto": {
			"version": "1.3.353"
		  },
		  "dir": "/project",
		  "engines": [
			"jupyter",
			"markdown"
		  ],
		  "config": {
			"project": {
			  "title": "this is the title"
			},
			"editor": "visual",
			"language": {}
		  },
		  "files": {
			"input": [
			  "/project/project.qmd",
			  "/project/other.qmd"
			],
			"resources": [],
			"config": [
			  "/project/_quarto.yml"
			],
			"configResources": []
		  }
	}`)
	executor.On("RunCommand", "quarto", []string{"inspect", "/project"}).Return(out, nil)
	detector.executor = executor

	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: filename,
		Title:      "this is the title",
		Validate:   true,
		Python:     &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"jupyter", "markdown"},
		},
	}, t)
}

func (s *QuartoDetectorSuite) TestInferTypeOnlyQuartoFile() {
	base := util.NewPath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "myfile.qmd"
	path := base.Join(filename)
	err = path.Join(filename).WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()

	executor := utiltest.NewMockExecutor()
	out := []byte(`{
		"quarto": {
			"version": "1.3.353"
		},
		"dir": "/project",
		"engines": [
		  "markdown"
		],
		"config": {
		"project": {
			"title": "this is the title"
		},
		"editor": "visual",
		"language": {}
		},
		"files": {
		"input": [
			"/project/project.qmd"
		],
		"resources": [],
		"config": [
			"/project/_quarto.yml"
		],
		"configResources": []
		}
	}`)

	executor.On("RunCommand", "quarto", []string{"inspect", "/project"}).Return(out, nil)
	detector.executor = executor

	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: filename,
		Title:      "this is the title",
		Validate:   true,
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"markdown"},
		},
	}, t)
}

func (s *QuartoDetectorSuite) TestInferTypeEntrypointErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, ".qmd", mock.Anything).Return("", util.Path{}, testError)

	detector := QuartoDetector{inferrer, nil}
	base := util.NewPath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	t, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}
