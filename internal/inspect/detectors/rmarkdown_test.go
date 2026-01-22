package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"runtime"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/executor/executortest"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type RMarkdownSuite struct {
	utiltest.Suite
}

func TestRMarkdownSuite(t *testing.T) {
	suite.Run(t, new(RMarkdownSuite))
}

const backticks = "```"

var basicRmdContent = fmt.Sprintf(`---
title: Special Report
---

# A Very Special Report

%s{r, echo=TRUE}
library(foo)
%s
`, backticks, backticks)

func (s *RMarkdownSuite) TestInferType() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	path := base.Join(filename)
	err = path.WriteFile([]byte(basicRmdContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Title:      "Special Report",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{"/report.Rmd"},
		R:          &config.R{},
	}, configs[0])
}

var pythonRmdContent = fmt.Sprintf(`---
title: Special Report
---

# A Very Special Report

%s{python, echo=TRUE}
import foo
%s
`, backticks, backticks)

func (s *RMarkdownSuite) TestInferTypeWithPython() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	path := base.Join(filename)
	err = path.WriteFile([]byte(pythonRmdContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Title:      "Special Report",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{"/report.Rmd"},
		Python:     &config.Python{},
	}, configs[0])
}

var parameterizedRmdContent = fmt.Sprintf(`---
title: Special Report
params:
  truthiness: TRUE
  exprtruthiness: !r TRUE
  f: 1.2
  # exprf: !r 1.4
  g: # floating with controls
    label: float
    value: 2.3
    min: 1.75
    max: 4.0
    step: 0.25
---

# A Very Special Report

%s{r, echo=TRUE}
library(foo)
%s
`, backticks, backticks)

func (s *RMarkdownSuite) TestInferTypeParameterized() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	path := base.Join(filename)
	err = path.WriteFile([]byte(parameterizedRmdContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	hasParams := true
	s.Equal(&config.Config{
		Schema:        schema.ConfigSchemaURL,
		Type:          contenttypes.ContentTypeRMarkdown,
		Title:         "Special Report",
		Entrypoint:    filename,
		Validate:      &validate,
		HasParameters: &hasParams,
		Files:         []string{"/report.Rmd"},
		R:             &config.R{},
	}, configs[0])
}

var shinyRmdRuntimeContent = fmt.Sprintf(`---
title: Interactive Report
runtime: shiny
---

# A Very Interactive Report

%s{r, echo=TRUE}
library(foo)
%s
`, backticks, backticks)

func (s *RMarkdownSuite) TestInferTypeShinyRmdRuntime() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	path := base.Join(filename)
	err = path.WriteFile([]byte(shinyRmdRuntimeContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdownShiny,
		Title:      "Interactive Report",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{"/report.Rmd"},
		R:          &config.R{},
	}, configs[0])
}

var shinyRmdServerContent = fmt.Sprintf(`---
title: Interactive Report
server: shiny
---

# A Very Interactive Report

%s{r, echo=TRUE}
library(foo)
%s
`, backticks, backticks)

func (s *RMarkdownSuite) TestInferTypeShinyRmdServer() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	path := base.Join(filename)
	err = path.WriteFile([]byte(shinyRmdServerContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdownShiny,
		Title:      "Interactive Report",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{"/report.Rmd"},
		R:          &config.R{},
	}, configs[0])
}

var shinyRmdServerTypeContent = fmt.Sprintf(`---
title: Interactive Report
server:
    type: shiny
---

# A Very Interactive Report

%s{r, echo=TRUE}
library(foo)
%s
`, backticks, backticks)

func (s *RMarkdownSuite) TestInferTypeShinyRmdServerType() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	path := base.Join(filename)
	err = path.WriteFile([]byte(shinyRmdServerTypeContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdownShiny,
		Title:      "Interactive Report",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{"/report.Rmd"},
		R:          &config.R{},
	}, configs[0])
}

var noMetaRmdContent = fmt.Sprintf(`
# Special Report

%s{r, echo=TRUE}
library(foo)
%s
`, backticks, backticks)

func (s *RMarkdownSuite) TestInferTypeNoMetadata() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	path := base.Join(filename)
	err = path.WriteFile([]byte(noMetaRmdContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Title:      "",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{"/report.Rmd"},
		R:          &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestInferTypeWithEntrypoint() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "report.Rmd"
	err = base.Join(filename).WriteFile([]byte(basicRmdContent), 0600)
	s.Nil(err)

	otherFilename := "something_else.Rmd"
	err = base.Join(otherFilename).WriteFile([]byte(basicRmdContent), 0600)
	s.Nil(err)

	detector := NewRMarkdownDetector(logging.New())
	entrypoint := util.NewRelativePath(filename, base.Fs())
	configs, err := detector.InferType(base, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Title:      "Special Report",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{"/report.Rmd"},
		R:          &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestInferTypeRmdSite() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "rmd-site")

	detector := NewRMarkdownDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	configs, err := detector.InferType(base, util.NewRelativePath("index.Rmd", nil))
	s.Nil(err)

	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Entrypoint: "index.Rmd",
		Title:      "Testing RMD Site",
		Validate:   &validate,
		Files: []string{
			"/_site.yml",
			"/index.Rmd",
			"/images/mario-jump.gif",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestInferTypeRmdSite_FromSiteYml() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "rmd-site")

	detector := NewRMarkdownDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	configs, err := detector.InferType(base, util.NewRelativePath("_site.yml", nil))
	s.Nil(err)

	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Entrypoint: "_site.yml",
		Title:      "Testing RMD Site",
		Validate:   &validate,
		Files: []string{
			"/_site.yml",
			"/index.Rmd",
			"/images/mario-jump.gif",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestInferTypeRmdSite_WithAssets() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "rmd-site")

	detector := NewRMarkdownDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	configs, err := detector.InferType(base, util.NewRelativePath("index.Rmd", nil))
	s.Nil(err)

	s.Len(configs, 1)
	cfg := configs[0]

	validate := true
	s.Equal(schema.ConfigSchemaURL, cfg.Schema)
	s.Equal(contenttypes.ContentTypeRMarkdown, cfg.Type)
	s.Equal("index.Rmd", cfg.Entrypoint)
	s.Equal("Testing RMD Site", cfg.Title)
	s.Equal(&validate, cfg.Validate)

	// Verify that asset discovery works for site projects
	s.Contains(cfg.Files, "/_site.yml")
	s.Contains(cfg.Files, "/index.Rmd")
	s.Contains(cfg.Files, "/images/mario-jump.gif")
	s.Equal(&config.R{}, cfg.R)
}

func (s *RMarkdownSuite) TestInferTypeRmdSite_FromSiteYml_NoMeta() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "rmd-site-no-meta")

	detector := NewRMarkdownDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	configs, err := detector.InferType(base, util.NewRelativePath("_site.yml", nil))
	s.Nil(err)

	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Entrypoint: "_site.yml",
		Title:      "",
		Validate:   &validate,
		Files: []string{
			"/_site.yml",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestInferTypeRmdSite_Bookdown() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "bookdown-proj")

	detector := NewRMarkdownDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	configs, err := detector.InferType(base, util.NewRelativePath("index.Rmd", nil))
	s.Nil(err)

	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Entrypoint: "index.Rmd",
		Title:      "A Minimal Book Example",
		Validate:   &validate,
		Files: []string{
			"/_bookdown.yml",
			"/index.Rmd",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestInferTypeRmdSite_FromBookdownYml() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "bookdown-proj")

	detector := NewRMarkdownDetector(logging.New())
	executor := executortest.NewMockExecutor()
	detector.executor = executor

	configs, err := detector.InferType(base, util.NewRelativePath("_bookdown.yml", nil))
	s.Nil(err)

	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Entrypoint: "_bookdown.yml",
		Title:      "A Minimal Book Example",
		Validate:   &validate,
		Files: []string{
			"/_bookdown.yml",
			"/index.Rmd",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestInferTypeStaticRmdWithAssets() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "rmd-static-with-assets")

	detector := NewRMarkdownDetector(logging.New())

	configs, err := detector.InferType(base, util.NewRelativePath("static-with-assets.Rmd", nil))
	s.Nil(err)

	s.Len(configs, 1)
	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRMarkdown,
		Entrypoint: "static-with-assets.Rmd",
		Title:      "Static R Markdown with Image",
		Validate:   &validate,
		Files: []string{
			"/static-with-assets.Rmd",
			"/assets/bear.jpg",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *RMarkdownSuite) TestFindAndIncludeAssets_NestedDirectoryDeduplication() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "rmd-nested-assets")

	detector := NewRMarkdownDetector(logging.New())

	cfg := config.New()
	cfg.Type = contenttypes.ContentTypeRMarkdown
	cfg.Entrypoint = "rmd-nested-assets.Rmd"
	cfg.Files = []string{
		"/rmd-nested-assets.Rmd",
		"/assets", // Parent directory is already added
	}

	detector.findAndIncludeAssets(base, cfg)

	// Nested files should not added since parent directory is included
	s.Equal([]string{
		"/rmd-nested-assets.Rmd",
		"/assets",
	}, cfg.Files)
}

func (s *RMarkdownSuite) TestInferTypeRmdWithResourceFiles() {
	if runtime.GOOS == "windows" {
		s.T().Skip("This test does not run on Windows")
	}

	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	base := realCwd.Join("testdata", "rmd-nested-assets")

	detector := NewRMarkdownDetector(logging.New())

	configs, err := detector.InferType(base, util.NewRelativePath("rmd-nested-assets.Rmd", nil))
	s.Nil(err)

	s.Len(configs, 1)
	cfg := configs[0]

	validate := true
	s.Equal(schema.ConfigSchemaURL, cfg.Schema)
	s.Equal(contenttypes.ContentTypeRMarkdown, cfg.Type)
	s.Equal("rmd-nested-assets.Rmd", cfg.Entrypoint)
	s.Equal("R Markdown Nested Assets Test", cfg.Title)
	s.Equal(&validate, cfg.Validate)

	// The entrypoint and resource_files from the YAML frontmatter should be discovered and included
	s.Contains(cfg.Files, "/rmd-nested-assets.Rmd")
	s.Contains(cfg.Files, "/assets/style.css")
	s.Contains(cfg.Files, "/assets/script.js")
	s.Contains(cfg.Files, "/assets/script-two.js")
	s.Contains(cfg.Files, "/assets/script-three.js")
	s.Len(cfg.Files, 5)
}
