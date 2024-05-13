package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"runtime"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor/executortest"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type QuartoDetectorSuite struct {
	utiltest.Suite
}

func TestQuartoDetectorSuite(t *testing.T) {
	suite.Run(t, new(QuartoDetectorSuite))
}

func (s *QuartoDetectorSuite) runInferType(testName string) []*config.Config {
	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", testName)

	detector := NewQuartoDetector()
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	dirOutputPath := base.Join("inspect.json")
	exists, err := dirOutputPath.Exists()
	s.NoError(err)

	if exists {
		dirOutput, err := dirOutputPath.ReadFile()
		s.NoError(err)
		executor.On("RunCommand", "quarto", []string{"inspect", base.String()}, mock.Anything, mock.Anything).Return(dirOutput, nil, nil)
	}

	files, err := detector.findEntrypoints(base)
	s.NoError(err)

	for _, filename := range files {
		fileBase := strings.TrimSuffix(filename.Base(), filename.Ext())
		outputPath := base.Join(fmt.Sprintf("inspect_%s.json", fileBase))
		fileOutput, err := outputPath.ReadFile()
		s.NoError(err)

		executor.On("RunCommand", "quarto", []string{"inspect", filename.String()}, mock.Anything, mock.Anything).Return(fileOutput, nil, nil)
	}

	configs, err := detector.InferType(base)
	s.Nil(err)
	return configs
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownDoc() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-doc-none")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "quarto-doc-none.qmd",
		Title:      "quarto-doc-none",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-none")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "quarto-proj-none.qmd",
		Title:      "quarto-proj-none",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownProjectWindows() {
	if runtime.GOOS != "windows" {
		s.T().Skip("This test only runs on Windows")
	}
	configs := s.runInferType("quarto-proj-none-windows")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "quarto-proj-none.qmd",
		Title:      "quarto-proj-none",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypePythonProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-py")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "quarto-proj-py.qmd",
		Title:      "quarto-proj-py",
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"jupyter"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "quarto-proj-r.qmd",
		Title:      "quarto-proj-r",
		Validate:   true,
		Files:      []string{"*"},
		R:          &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"knitr"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRAndPythonProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r-py")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "quarto-proj-r-py.qmd",
		Title:      "quarto-proj-r-py",
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
		R:          &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"jupyter", "knitr"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRShinyProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r-shiny")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuartoShiny,
		Entrypoint: "quarto-proj-r-shiny.qmd",
		Title:      "quarto-proj-r-shiny",
		Validate:   true,
		Files:      []string{"*"},
		R:          &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"knitr"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeQuartoWebsite() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-website-none")
	s.Len(configs, 2)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "about.qmd",
		Title:      "About",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "index.qmd",
		Title:      "quarto-website-none",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[1])
}

func (s *QuartoDetectorSuite) TestInferTypeRMarkdownDoc() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("rmd-static-1")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "static.Rmd",
		Title:      "static",
		Validate:   true,
		Files:      []string{"*"},
		R:          &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"knitr"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMultidocProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-multidoc-proj-none")
	s.Len(configs, 2)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "document1.qmd",
		Title:      "quarto-proj-none-multidocument",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "document2.qmd",
		Title:      "quarto-proj-none-multidocument",
		Validate:   true,
		Files:      []string{"*"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[1])
}
