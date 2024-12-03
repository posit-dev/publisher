package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"runtime"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

	detector := NewQuartoDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	dirOutputPath := base.Join("inspect.json")
	exists, err := dirOutputPath.Exists()
	s.NoError(err)

	// Replace the $DIR placeholder in the file with
	// the correct path (json-escaped)
	placeholder := []byte("$DIR")
	baseDir, err := json.Marshal(base.Dir().String())
	s.NoError(err)
	baseDir = baseDir[1 : len(baseDir)-1]

	if exists {
		dirOutput, err := dirOutputPath.ReadFile()
		s.NoError(err)
		dirOutput = bytes.ReplaceAll(dirOutput, placeholder, baseDir)
		executor.On("RunCommand", "quarto", []string{"inspect", base.String()}, mock.Anything, mock.Anything).Return(dirOutput, nil, nil)
	}

	files, err := detector.findEntrypoints(base)
	s.NoError(err)

	for _, filename := range files {
		fileBase := strings.TrimSuffix(filename.Base(), filename.Ext())
		outputPath := base.Join(fmt.Sprintf("inspect_%s.json", fileBase))
		fileOutput, err := outputPath.ReadFile()
		s.NoError(err)
		fileOutput = bytes.ReplaceAll(fileOutput, placeholder, baseDir)
		executor.On("RunCommand", "quarto", []string{"inspect", filename.String()}, mock.Anything, mock.Anything).Return(fileOutput, nil, nil)
	}

	configs, err := detector.InferType(base, util.RelativePath{})
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
		Files:      []string{},
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
		Files:      []string{"/quarto-proj-none.qmd", "/_quarto.yml"},
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
		Files:      []string{"/quarto-proj-none.qmd", "/_quarto.yml"},
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
		Files:      []string{"/quarto-proj-py.qmd", "/_quarto.yml"},
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
		Files:      []string{"/quarto-proj-r.qmd", "/_quarto.yml"},
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
		Files:      []string{"/quarto-proj-r-py.qmd", "/_quarto.yml"},
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
		Files:      []string{"/quarto-proj-r-shiny.qmd", "/_quarto.yml"},
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
		Files:      []string{"/index.qmd", "/about.qmd", "/_quarto.yml"},
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
		Files: []string{
			"/index.qmd",
			"/about.qmd",
			"/styles.css",
			"/_quarto.yml",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[1])
}

func (s *QuartoDetectorSuite) TestInferTypeQuartoWebsite_viaQuartoYml() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	// configs := s.runInferType("quarto-website-none")
	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "quarto-website-via-yaml")

	detector := NewQuartoDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	dirOutputPath := base.Join("inspect.json")
	exists, err := dirOutputPath.Exists()
	s.NoError(err)
	s.True(exists)

	// Replace the $DIR placeholder in the file with
	// the correct path (json-escaped)
	placeholder := []byte("$DIR")
	baseDir, err := json.Marshal(base.Dir().String())
	s.NoError(err)
	baseDir = baseDir[1 : len(baseDir)-1]

	dirOutput, err := dirOutputPath.ReadFile()
	s.NoError(err)
	dirOutput = bytes.ReplaceAll(dirOutput, placeholder, baseDir)
	executor.On("RunCommand", "quarto", []string{"inspect", base.String()}, mock.Anything, mock.Anything).Return(dirOutput, nil, nil)

	configs, err := detector.InferType(base, util.NewRelativePath("_quarto.yml", nil))
	s.Nil(err)

	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "_quarto.yml",
		Title:      "Content Dashboard",
		Validate:   true,
		Files: []string{
			"/all.qmd",
			"/index.qmd",
			"/about.qmd",
			"/bibliography.bib",
			"/palmer-penguins.csv",
			"/prepare.py",
			"/finally.py",
			"/_quarto.yml",
			"/_brand.yml",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"jupyter", "markdown"},
		},
		Python: &config.Python{},
	}, configs[0])
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
		Files:      []string{},
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
		Files:      []string{"/document1.qmd", "/document2.qmd", "/_quarto.yml"},
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
		Files:      []string{"/document1.qmd", "/document2.qmd", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
	}, configs[1])
}

func (s *QuartoDetectorSuite) TestInferTypeNotebook() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("stock-report-jupyter")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "stock-report-jupyter.ipynb",
		Title:      "Stock Report: TSLA",
		Validate:   true,
		Files:      []string{"/stock-report-jupyter.ipynb"},
		Python:     &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"jupyter"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRevalJSQuartoShiny() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("dashboard")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuartoShiny,
		Entrypoint: "dashboard.qmd",
		Title:      "posit::conf(2024)",
		Validate:   true,
		Files:      []string{"/dashboard.qmd"},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"knitr"},
		},
		R: &config.R{},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeQuartoScriptPy() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-script-py")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "script.py",
		Title:      "Penguin data transformations",
		Validate:   true,
		Files:      []string{"/script.py", "/_quarto.yml"},
		Python:     &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"jupyter"},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeQuartoScriptR() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-script-r")
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeQuarto,
		Entrypoint: "script.R",
		Title:      "Penguin data transformations",
		Validate:   true,
		Files:      []string{"/script.R", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"knitr"},
		},
		R: &config.R{},
	}, configs[0])
}
