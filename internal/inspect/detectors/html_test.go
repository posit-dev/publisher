package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type StaticHTMLDetectorSuite struct {
	utiltest.Suite
}

func TestStaticHTMLDetectorSuite(t *testing.T) {
	suite.Run(t, new(StaticHTMLDetectorSuite))
}

func (s *StaticHTMLDetectorSuite) TestInferTypePreferredFilename() {
	base := util.NewPath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "index.html"
	path := base.Join(filename)
	err = path.Join(filename).WriteFile([]byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeHTML,
		Entrypoint: filename,
		Validate:   true,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeOnlyHTMLFile() {
	base := util.NewPath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "myfile.html"
	path := base.Join(filename)
	err = path.Join(filename).WriteFile([]byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeHTML,
		Entrypoint: filename,
		Validate:   true,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeEntrypointHTMLErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, ".html", mock.Anything).Return("", util.Path{}, testError)

	detector := StaticHTMLDetector{inferrer}
	base := util.NewPath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	t, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeEntrypointHTMErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, ".html", mock.Anything).Return("", util.Path{}, nil)
	inferrer.On("InferEntrypoint", mock.Anything, ".htm", mock.Anything).Return("", util.Path{}, testError)

	detector := StaticHTMLDetector{inferrer}
	base := util.NewPath("/project", afero.NewMemMapFs())
	t, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}
