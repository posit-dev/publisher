package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/connect-client/internal/apptypes"
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

func (s *StaticHTMLDetectorSuite) TestInferTypeSpecifiedFile() {
	filename := "myfile.html"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(fs, filename)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.StaticMode,
		Entrypoint: filename,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypePreferredFilename() {
	filename := "index.html"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.StaticMode,
		Entrypoint: filename,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeOnlyHTMLFile() {
	filename := "myfile.html"
	fs := afero.NewMemMapFs()
	err := afero.WriteFile(fs, filename, []byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.StaticMode,
		Entrypoint: filename,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeEntrypointHTMLErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, ".html", mock.Anything).Return("", "", testError)

	detector := StaticHTMLDetector{inferrer}
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeEntrypointHTMErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, ".html", mock.Anything).Return("", "", nil)
	inferrer.On("InferEntrypoint", mock.Anything, mock.Anything, ".htm", mock.Anything).Return("", "", testError)

	detector := StaticHTMLDetector{inferrer}
	t, err := detector.InferType(utiltest.NewMockFs(), ".")
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}
