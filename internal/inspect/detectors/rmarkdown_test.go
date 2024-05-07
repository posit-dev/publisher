package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRMarkdown,
		Title:      "Special Report",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRMarkdown,
		Title:      "Special Report",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
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
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:        schema.ConfigSchemaURL,
		Type:          config.ContentTypeRMarkdown,
		Title:         "Special Report",
		Entrypoint:    filename,
		Validate:      true,
		HasParameters: true,
		Files:         []string{"*"},
		R:             &config.R{},
	}, t)
}
