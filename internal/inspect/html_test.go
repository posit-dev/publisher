package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/rstudio/publishing-client/internal/apptypes"
	"github.com/rstudio/publishing-client/internal/util"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
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
	path := util.NewPath(filename, afero.NewMemMapFs())
	err := path.WriteFile([]byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(path)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.StaticMode,
		Entrypoint: filename,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypePreferredFilename() {
	filename := "index.html"
	path := util.NewPath(".", afero.NewMemMapFs())
	err := path.Join(filename).WriteFile([]byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(path)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.StaticMode,
		Entrypoint: filename,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeOnlyHTMLFile() {
	filename := "myfile.html"
	path := util.NewPath(".", afero.NewMemMapFs())
	err := path.Join(filename).WriteFile([]byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	t, err := detector.InferType(path)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.StaticMode,
		Entrypoint: filename,
	}, t)
}

func (s *StaticHTMLDetectorSuite) TestInferTypeEntrypointHTMLErr() {
	inferrer := &MockInferenceHelper{}
	testError := errors.New("test error from InferEntrypoint")
	inferrer.On("InferEntrypoint", mock.Anything, ".html", mock.Anything).Return("", util.Path{}, testError)

	detector := StaticHTMLDetector{inferrer}
	path := util.NewPath(".", utiltest.NewMockFs())
	t, err := detector.InferType(path)
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
	path := util.NewPath(".", utiltest.NewMockFs())
	t, err := detector.InferType(path)
	s.NotNil(err)
	s.ErrorIs(err, testError)
	s.Nil(t)
}
