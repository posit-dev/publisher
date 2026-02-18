package contenttypes

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/suite"
)

type ContentTypeSuite struct {
	suite.Suite
}

func TestContentTypeSuite(t *testing.T) {
	suite.Run(t, new(ContentTypeSuite))
}

func (s *ContentTypeSuite) TestIsRContent() {
	rContentTypes := []ContentType{
		ContentTypeRPlumber,
		ContentTypeRShiny,
		ContentTypeRMarkdownShiny,
		ContentTypeRMarkdown,
	}
	for _, ct := range rContentTypes {
		s.True(ct.IsRContent(), "Expected %s to be R content", ct)
	}

	nonRContentTypes := []ContentType{
		ContentTypeHTML,
		ContentTypeJupyterNotebook,
		ContentTypePythonShiny,
		ContentTypePythonFastAPI,
		ContentTypeQuarto,
		ContentTypeUnknown,
	}
	for _, ct := range nonRContentTypes {
		s.False(ct.IsRContent(), "Expected %s to not be R content", ct)
	}
}

func (s *ContentTypeSuite) TestIsPythonContent() {
	pythonContentTypes := []ContentType{
		ContentTypeJupyterNotebook,
		ContentTypeJupyterVoila,
		ContentTypePythonBokeh,
		ContentTypePythonDash,
		ContentTypePythonFastAPI,
		ContentTypePythonFlask,
		ContentTypePythonGradio,
		ContentTypePythonPanel,
		ContentTypePythonShiny,
		ContentTypePythonStreamlit,
	}
	for _, ct := range pythonContentTypes {
		s.True(ct.IsPythonContent(), "Expected %s to be Python content", ct)
	}

	nonPythonContentTypes := []ContentType{
		ContentTypeHTML,
		ContentTypeRPlumber,
		ContentTypeRShiny,
		ContentTypeRMarkdown,
		ContentTypeQuarto,
		ContentTypeUnknown,
	}
	for _, ct := range nonPythonContentTypes {
		s.False(ct.IsPythonContent(), "Expected %s to not be Python content", ct)
	}
}
