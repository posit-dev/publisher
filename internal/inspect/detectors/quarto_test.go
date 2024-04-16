package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"runtime"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor/executortest"
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

func (s *QuartoDetectorSuite) TestInferType() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	// A quarto file must exist before we try to run `quarto inspect`
	err = base.Join("project.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("other.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("_quarto.yml").WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", "quarto", []string{"inspect", "/project"}, mock.Anything).Return([]byte(`{
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
				"/project/project.qmd",
				"/project/other.qmd"
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
		Entrypoint: "project.qmd",
		Title:      "this is the title",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"markdown"},
		},
	}, t)
}

func (s *QuartoDetectorSuite) TestInferTypeWithPython() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	// A quarto file must exist before we try to run `quarto inspect`
	err = base.Join("project.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("other.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("_quarto.yml").WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()
	executor := executortest.NewMockExecutor()
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
	executor.On("RunCommand", "quarto", []string{"inspect", "/project"}, mock.Anything).Return(out, nil)
	detector.executor = executor

	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "project.qmd",
		Title:      "this is the title",
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"jupyter", "markdown"},
		},
	}, t)
}

func (s *QuartoDetectorSuite) TestInferTypeNonProject() {
	// Without _quarto.yml, inspect the qmd file instead.
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	// A quarto file must exist before we try to run `quarto inspect`
	err = base.Join("project.qmd").WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()
	executor := executortest.NewMockExecutor()
	out := []byte(`{
		"quarto": {
		  "version": "1.3.353"
		},
		"engines": [
		  "markdown"
		],
		"formats": {
		  "html": {
			"identifier": {
			  "display-name": "HTML",
			  "target-format": "html",
			  "base-format": "html"
			},
			"execute": {
			  "fig-width": 7,
			  "fig-height": 5,
			  "engine": "markdown"
			},
			"render": {
			  "keep-tex": false,
			  "keep-source": false,
			  "keep-hidden": false
			},
			"pandoc": {
			  "standalone": true,
			  "wrap": "none",
			  "default-image-extension": "png",
			  "to": "html",
			  "output-file": "quarto-doc-none.html"
			},
			"language": {
			  "toc-title-document": "Table of contents",
			  "toc-title-website": "On this page"
			},
			"metadata": {
			  "lang": "en",
			  "fig-responsive": true,
			  "quarto-version": "1.3.353",
			  "title": "quarto-doc-none-test-title"
			},
			"extensions": {
			  "book": {
				"multiFile": true
			  }
			}
		  }
		},
		"resources": []
	  }`)
	executor.On("RunCommand", "quarto", []string{"inspect", "/project/project.qmd"}, mock.Anything).Return(out, nil)
	detector.executor = executor

	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "project.qmd",
		Title:      "quarto-doc-none-test-title",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"markdown"},
		},
	}, t)
}

func (s *QuartoDetectorSuite) TestInferWindows() {
	if runtime.GOOS != "windows" {
		s.T().Skip("TestInferWindows test only runs on Windows")
	}
	base := util.NewAbsolutePath("C:\\project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	// A quarto file must exist before we try to run `quarto inspect`
	err = base.Join("project.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("other.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("_quarto.yml").WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()
	executor := executortest.NewMockExecutor()
	executor.On("RunCommand", "quarto", []string{"inspect", base.String()}, mock.Anything).Return([]byte(`{
		"quarto": {
			"version": "1.3.353"
		  },
		  "dir": "C:\\Users\\somebody\\work\\project",
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
				"C:\\Users\\somebody\\work\\project\\project.qmd",
				"C:\\Users\\somebody\\work\\project\\other.qmd"
			],
			"resources": [],
			"config": [
			  "C:\\Users\\somebody\\work\\project\\_quarto.yml"
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
		Entrypoint: "project.qmd",
		Title:      "this is the title",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"markdown"},
		},
	}, t)
}

func (s *QuartoDetectorSuite) TestInferTypeQuartoWebsite() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	// A quarto file must exist before we try to run `quarto inspect`
	err = base.Join("index.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("about.qmd").WriteFile(nil, 0600)
	s.Nil(err)
	err = base.Join("_quarto.yml").WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewQuartoDetector()

	executor := executortest.NewMockExecutor()
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
			"type": "website",
			"lib-dir": "site_libs",
			"output-dir": "_site"
		  },
		  "format": {
			"html": {
			  "theme": "cosmo",
			  "css": "styles.css",
			  "toc": true
			}
		  },
		  "website": {
			"title": "website",
			"navbar": {
			  "type": "dark",
			  "background": "primary",
			  "left": [
				{
				  "href": "index.qmd",
				  "text": "Home"
				},
				"about.qmd"
			  ]
			}
		  },
		  "language": {}
		},
		"files": {
		  "input": [
			"/project/about.qmd",
			"/project/index.qmd"
		  ],
		  "resources": [],
		  "config": [
			"/project/_quarto.yml"
		  ],
		  "configResources": [
			"/project/styles.css"
		  ]
		}
	  }`)

	executor.On("RunCommand", "quarto", []string{"inspect", "/project"}, mock.Anything).Return(out, nil)
	detector.executor = executor

	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "index.qmd",
		Title:      "website",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.3.353",
			Engines: []string{"markdown"},
		},
	}, t)
}
