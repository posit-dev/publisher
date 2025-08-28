package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	baseDir, err := json.Marshal(base.String())
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
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-doc-none.qmd",
		Title:      "quarto-doc-none",
		Validate:   &validate,
		Files: []string{
			"/quarto-doc-none.qmd",
			"/subdir/subpage.qmd",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-doc-none.html",
				Title:      "quarto-doc-none",
				Validate:   &validate,
				Files: []string{
					"/quarto-doc-none.html",
					"/subdir/subpage.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-none")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-none.qmd",
		Title:      "quarto-proj-none",
		Validate:   &validate,
		Files:      []string{"/quarto-proj-none.qmd", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-none.html",
				Title:      "quarto-proj-none",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-none.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownProjectWindows() {
	if runtime.GOOS != "windows" {
		s.T().Skip("This test only runs on Windows")
	}
	configs := s.runInferType("quarto-proj-none-windows")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-none.qmd",
		Title:      "quarto-proj-none",
		Validate:   &validate,
		Files:      []string{"/quarto-proj-none.qmd", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-none.html",
				Title:      "quarto-proj-none",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-none.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypePythonProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-py")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-py.qmd",
		Title:      "quarto-proj-py",
		Validate:   &validate,
		Files:      []string{"/quarto-proj-py.qmd", "/_quarto.yml"},
		Python:     &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"jupyter"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-py.html",
				Title:      "quarto-proj-py",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-py.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-r.qmd",
		Title:      "quarto-proj-r",
		Validate:   &validate,
		Files:      []string{"/quarto-proj-r.qmd", "/_quarto.yml"},
		R:          &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"knitr"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-r.html",
				Title:      "quarto-proj-r",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-r.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRAndPythonProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r-py")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-r-py.qmd",
		Title:      "quarto-proj-r-py",
		Validate:   &validate,
		Files:      []string{"/quarto-proj-r-py.qmd", "/_quarto.yml"},
		Python:     &config.Python{},
		R:          &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"jupyter", "knitr"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-r-py.html",
				Title:      "quarto-proj-r-py",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-r-py.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRShinyProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r-shiny")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuartoShiny,
		Entrypoint: "quarto-proj-r-shiny.qmd",
		Title:      "quarto-proj-r-shiny",
		Validate:   &validate,
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
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "about.qmd",
		Title:      "About",
		Validate:   &validate,
		Files:      []string{"/index.qmd", "/about.qmd", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "_site",
				Title:      "About",
				Validate:   &validate,
				Files: []string{
					"/_site",
				},
			},
		},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "index.qmd",
		Title:      "quarto-website-none",
		Validate:   &validate,
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
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "_site",
				Title:      "quarto-website-none",
				Validate:   &validate,
				Files: []string{
					"/_site",
				},
			},
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
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "_quarto.yml",
		Title:      "Content Dashboard",
		Validate:   &validate,
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
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "_site",
				Title:      "Content Dashboard",
				Validate:   &validate,
				Files: []string{
					"/_site",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRMarkdownDoc() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("rmd-static-1")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "static.Rmd",
		Title:      "static",
		Validate:   &validate,
		Files: []string{
			"/static.Rmd",
		},
		R: &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"knitr"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "static.html",
				Title:      "static",
				Validate:   &validate,
				Files: []string{
					"/static.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMultidocProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-multidoc-proj-none")
	s.Len(configs, 2)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "document1.qmd",
		Title:      "quarto-proj-none-multidocument",
		Validate:   &validate,
		Files:      []string{"/document1.qmd", "/document2.qmd", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "document1.html",
				Title:      "quarto-proj-none-multidocument",
				Validate:   &validate,
				Files: []string{
					"/document1.html",
					"/document2.html",
				},
			},
		},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "document2.qmd",
		Title:      "quarto-proj-none-multidocument",
		Validate:   &validate,
		Files:      []string{"/document1.qmd", "/document2.qmd", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "document1.html",
				Title:      "quarto-proj-none-multidocument",
				Validate:   &validate,
				Files: []string{
					"/document1.html",
					"/document2.html",
				},
			},
		},
	}, configs[1])
}

func (s *QuartoDetectorSuite) TestInferTypeNotebook() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("stock-report-jupyter")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "stock-report-jupyter.ipynb",
		Title:      "Stock Report: TSLA",
		Validate:   &validate,
		Files:      []string{"/stock-report-jupyter.ipynb"},
		Python:     &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"jupyter"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "stock-report-jupyter.html",
				Title:      "Stock Report: TSLA",
				Validate:   &validate,
				Files: []string{
					"/stock-report-jupyter.html",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRevalJSQuartoShiny() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("dashboard")
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuartoShiny,
		Entrypoint: "dashboard.qmd",
		Title:      "posit::conf(2024)",
		Validate:   &validate,
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
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "script.py",
		Title:      "Penguin data transformations",
		Validate:   &validate,
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
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "script.R",
		Title:      "Penguin data transformations",
		Validate:   &validate,
		Files:      []string{"/script.R", "/_quarto.yml"},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"knitr"},
		},
		R: &config.R{},
	}, configs[0])
}
