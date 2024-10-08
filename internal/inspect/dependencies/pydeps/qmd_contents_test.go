package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type QMDContentsSuite struct {
	utiltest.Suite
}

func TestQMDContentsSuite(t *testing.T) {
	suite.Run(t, new(QMDContentsSuite))
}

func (s *QMDContentsSuite) TestGetQuartoFilePythonCode() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	path := cwd.Join("testdata", "test.qmd")

	inputs, err := GetQuartoFilePythonCode(path)
	s.Nil(err)
	s.Equal("import that\nfrom example import *\n\nthat.do_something()\n", inputs)
}

func (s *QMDContentsSuite) TestDetectMarkdownLanguagesInContentEmpty() {
	r, py := DetectMarkdownLanguagesInContent([]byte{})
	s.False(r)
	s.False(py)
}

func (s *QMDContentsSuite) TestDetectMarkdownLanguagesInContentRBlock() {
	r, py := DetectMarkdownLanguagesInContent([]byte("```{r echo=TRUE}\nlibrary(foo)\n```"))
	s.True(r)
	s.False(py)
}

func (s *QMDContentsSuite) TestDetectMarkdownLanguagesInContentRBlockWithComma() {
	r, py := DetectMarkdownLanguagesInContent([]byte("```{r, echo=TRUE}\nlibrary(foo)\n```"))
	s.True(r)
	s.False(py)
}

func (s *QMDContentsSuite) TestDetectMarkdownLanguagesInContentRInline() {
	r, py := DetectMarkdownLanguagesInContent([]byte("`r library(foo)`"))
	s.True(r)
	s.False(py)
}

func (s *QMDContentsSuite) TestDetectMarkdownLanguagesInContentPythonBlock() {
	r, py := DetectMarkdownLanguagesInContent([]byte("```{python}\nimport foo\n```"))
	s.False(r)
	s.True(py)
}

func (s *QMDContentsSuite) TestDetectMarkdownLanguagesInContentPythonInline() {
	r, py := DetectMarkdownLanguagesInContent([]byte("`python import foo`"))
	s.False(r)
	s.True(py)
}

func (s *QMDContentsSuite) TestDetectMarkdownLanguagesBothBlock() {
	r, py := DetectMarkdownLanguagesInContent([]byte("```{r echo=TRUE}\nlibrary(foo)\n```\n```{python}\nimport foo\n```"))
	s.True(r)
	s.True(py)
}
