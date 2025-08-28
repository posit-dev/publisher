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
		Files:      []string{},
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
		Files:      []string{},
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
		Files:         []string{},
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
		Files:      []string{},
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
		Files:      []string{},
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
		Files:      []string{},
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
		Files:      []string{},
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
		Files:      []string{},
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
		},
		R: &config.R{},
	}, configs[0])
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
