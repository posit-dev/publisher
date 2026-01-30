package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"errors"
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

func (s *QuartoDetectorSuite) runInferType(testName string, withError error) []*config.Config {
	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", testName)

	detector := NewQuartoDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	rsrcFinderMock := &resourceFinderMock{
		resources: []ExternalResource{
			{Path: "found-a-logo-somewhere.png"},
			{Path: "and-some-graph-too.svg"},
		},
	}
	detector.resourceFinderFactory = makeResourceFinderFactoryMock(rsrcFinderMock, nil)

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
		executor.On("RunCommand", "quarto", []string{"inspect", base.String()}, mock.Anything, mock.Anything).Return(dirOutput, nil, withError)
	}

	files, err := detector.findEntrypoints(base)
	s.NoError(err)

	for _, filename := range files {
		fileBase := strings.TrimSuffix(filename.Base(), filename.Ext())
		outputPath := base.Join(fmt.Sprintf("inspect_%s.json", fileBase))
		fileOutput, err := outputPath.ReadFile()
		s.NoError(err)
		fileOutput = bytes.ReplaceAll(fileOutput, placeholder, baseDir)
		executor.On("RunCommand", "quarto", []string{"inspect", filename.String()}, mock.Anything, mock.Anything).Return(fileOutput, nil, withError)
	}

	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	return configs
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownDoc() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-doc-none", nil)
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
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
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
				Source:     "quarto-doc-none.qmd",
				Title:      "quarto-doc-none",
				Validate:   &validate,
				Files: []string{
					"/quarto-doc-none.html",
					"/subdir/subpage.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-none", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-none.qmd",
		Title:      "quarto-proj-none",
		Validate:   &validate,
		Files: []string{
			"/quarto-proj-none.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-none.html",
				Source:     "quarto-proj-none.qmd",
				Title:      "quarto-proj-none",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-none.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMarkdownProjectWindows() {
	if runtime.GOOS != "windows" {
		s.T().Skip("This test only runs on Windows")
	}
	configs := s.runInferType("quarto-proj-none-windows", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-none.qmd",
		Title:      "quarto-proj-none",
		Validate:   &validate,
		Files: []string{
			"/quarto-proj-none.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-none.html",
				Source:     "quarto-proj-none.qmd",
				Title:      "quarto-proj-none",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-none.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypePythonProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-py", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-py.qmd",
		Title:      "quarto-proj-py",
		Validate:   &validate,
		Files: []string{
			"/quarto-proj-py.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Python: &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"jupyter"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-py.html",
				Source:     "quarto-proj-py.qmd",
				Title:      "quarto-proj-py",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-py.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-r.qmd",
		Title:      "quarto-proj-r",
		Validate:   &validate,
		Files: []string{
			"/quarto-proj-r.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
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
				Entrypoint: "quarto-proj-r.html",
				Source:     "quarto-proj-r.qmd",
				Title:      "quarto-proj-r",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-r.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRAndPythonProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r-py", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-r-py.qmd",
		Title:      "quarto-proj-r-py",
		Validate:   &validate,
		Files: []string{
			"/quarto-proj-r-py.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Python: &config.Python{},
		R:      &config.R{},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"jupyter", "knitr"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "quarto-proj-r-py.html",
				Source:     "quarto-proj-r-py.qmd",
				Title:      "quarto-proj-r-py",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-r-py.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRShinyProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r-shiny", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuartoShiny,
		Entrypoint: "quarto-proj-r-shiny.qmd",
		Title:      "quarto-proj-r-shiny",
		Validate:   &validate,
		Files: []string{
			"/quarto-proj-r-shiny.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		R: &config.R{},
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
	configs := s.runInferType("quarto-website-none", nil)
	s.Len(configs, 2)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "about.qmd",
		Title:      "About",
		Validate:   &validate,
		Files: []string{
			"/index.qmd",
			"/about.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "_site/about.html",
				Source:     "about.qmd",
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
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "_site/index.html",
				Source:     "index.qmd",
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
	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "quarto-website-via-yaml")

	detector := NewQuartoDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	rsrcFinderMock := &resourceFinderMock{
		resources: []ExternalResource{
			{Path: "found-a-logo-somewhere.png"},
			{Path: "and-some-graph-too.svg"},
		},
	}
	detector.resourceFinderFactory = makeResourceFinderFactoryMock(rsrcFinderMock, nil)

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
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
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
				Entrypoint: "_site/index.html",
				Source:     "_quarto.yml",
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
	configs := s.runInferType("rmd-static-1", nil)
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
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
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
				Source:     "static.Rmd",
				Title:      "static",
				Validate:   &validate,
				Files: []string{
					"/static.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeMultidocProject() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-multidoc-proj-none", nil)
	s.Len(configs, 2)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "document1.qmd",
		Title:      "quarto-proj-none-multidocument",
		Validate:   &validate,
		Files: []string{
			"/document1.qmd",
			"/document2.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "document1.html",
				Source:     "document1.qmd",
				Title:      "quarto-proj-none-multidocument",
				Validate:   &validate,
				Files: []string{
					"/document1.html",
					"/document1_files",
					"/document2.html",
					"/document2_files",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
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
		Files: []string{
			"/document1.qmd",
			"/document2.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.4.553",
			Engines: []string{"markdown"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "document1.html",
				Source:     "document2.qmd",
				Title:      "quarto-proj-none-multidocument",
				Validate:   &validate,
				Files: []string{
					"/document1.html",
					"/document1_files",
					"/document2.html",
					"/document2_files",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[1])
}

func (s *QuartoDetectorSuite) TestInferTypeNotebook() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("stock-report-jupyter", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "stock-report-jupyter.ipynb",
		Title:      "Stock Report: TSLA",
		Validate:   &validate,
		Files: []string{
			"/stock-report-jupyter.ipynb",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Python: &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"jupyter"},
		},
		Alternatives: []config.Config{
			{
				Schema:     schema.ConfigSchemaURL,
				Type:       contenttypes.ContentTypeHTML,
				Entrypoint: "stock-report-jupyter.html",
				Source:     "stock-report-jupyter.ipynb",
				Title:      "Stock Report: TSLA",
				Validate:   &validate,
				Files: []string{
					"/stock-report-jupyter.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferTypeRevalJSQuartoShiny() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("dashboard", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuartoShiny,
		Entrypoint: "dashboard.qmd",
		Title:      "posit::conf(2024)",
		Validate:   &validate,
		Files: []string{
			"/dashboard.qmd",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
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
	configs := s.runInferType("quarto-script-py", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "script.py",
		Title:      "Penguin data transformations",
		Validate:   &validate,
		Files: []string{
			"/script.py",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Python: &config.Python{},
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
	configs := s.runInferType("quarto-script-r", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "script.R",
		Title:      "Penguin data transformations",
		Validate:   &validate,
		Files: []string{
			"/script.R",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.5.54",
			Engines: []string{"knitr"},
		},
		R: &config.R{},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferIncludeExtensionsDir() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-proj-r-with-extensions", nil)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "quarto-proj-r.qmd",
		Title:      "quarto-proj-r",
		Validate:   &validate,
		Files: []string{
			"/quarto-proj-r.qmd",
			"/_quarto.yml",
			"/_extensions",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
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
				Entrypoint: "quarto-proj-r.html",
				Source:     "quarto-proj-r.qmd",
				Title:      "quarto-proj-r",
				Validate:   &validate,
				Files: []string{
					"/quarto-proj-r.html",
					"/found-a-logo-somewhere.png",
					"/and-some-graph-too.svg",
				},
			},
		},
	}, configs[0])
}

func (s *QuartoDetectorSuite) TestInferType_NoBinary_SimpleConfig() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	configs := s.runInferType("quarto-website-none", errors.New("executable file not found in $PATH"))
	s.Len(configs, 2)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "about.qmd",
		Title:      "",
		Validate:   &validate,
		Files: []string{
			"/about.qmd",
			"/index.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.7.34",
		},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "index.qmd",
		Title:      "",
		Validate:   &validate,
		Files: []string{
			"/about.qmd",
			"/index.qmd",
			"/_quarto.yml",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Quarto: &config.Quarto{
			Version: "1.7.34",
		},
	}, configs[1])
}

func (s *QuartoDetectorSuite) TestInferType_NoBinary_Notebook() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}
	// Test that standalone notebooks get a Quarto config even when quarto inspect fails
	configs := s.runInferType("stock-report-jupyter", errors.New("executable file not found in $PATH"))
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeQuarto,
		Entrypoint: "stock-report-jupyter.ipynb",
		Title:      "",
		Validate:   &validate,
		Files: []string{
			"/stock-report-jupyter.ipynb",
			"/found-a-logo-somewhere.png",
			"/and-some-graph-too.svg",
		},
		Python: &config.Python{},
		Quarto: &config.Quarto{
			Version: "1.7.34",
			Engines: []string{"jupyter"},
		},
	}, configs[0])
}
