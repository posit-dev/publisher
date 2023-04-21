package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/publish/apptypes"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type AllSuite struct {
	utiltest.Suite
}

func TestAllSuite(t *testing.T) {
	suite.Run(t, new(AllSuite))
}

func (s *AllSuite) TestInferTypeDirectory() {
	fs := afero.NewMemMapFs()

	htmlFilename := "myfile.html"
	err := afero.WriteFile(fs, htmlFilename, []byte("<html></html>\n"), 0600)
	s.Nil(err)

	appFilename := "myapp.py"
	err = afero.WriteFile(fs, appFilename, []byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewContentTypeDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:        apptypes.PythonDashMode,
		Entrypoint:     appFilename,
		RequiresPython: true,
	}, t)
}

func (s *AllSuite) TestInferTypeFileLowerPriority() {
	fs := afero.NewMemMapFs()

	htmlFilename := "myfile.html"
	err := afero.WriteFile(fs, htmlFilename, []byte("<html></html>\n"), 0600)
	s.Nil(err)

	appFilename := "app.py"
	err = afero.WriteFile(fs, appFilename, []byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewContentTypeDetector()
	t, err := detector.InferType(fs, htmlFilename)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:    apptypes.StaticMode,
		Entrypoint: htmlFilename,
	}, t)
}

func (s *AllSuite) TestInferTypeFileHigherPriority() {
	fs := afero.NewMemMapFs()

	htmlFilename := "myfile.html"
	err := afero.WriteFile(fs, htmlFilename, []byte("<html></html>\n"), 0600)
	s.Nil(err)

	appFilename := "myapp.py"
	err = afero.WriteFile(fs, appFilename, []byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewContentTypeDetector()
	t, err := detector.InferType(fs, appFilename)
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:        apptypes.PythonDashMode,
		Entrypoint:     appFilename,
		RequiresPython: true,
	}, t)
}

func (s *AllSuite) TestInferTypeDirectoryPriority() {
	fs := afero.NewMemMapFs()

	htmlFilename := "myfile.html"
	err := afero.WriteFile(fs, htmlFilename, []byte("<html></html>\n"), 0600)
	s.Nil(err)

	appFilename := "myapp.py"
	err = afero.WriteFile(fs, appFilename, []byte("import dash\n"), 0600)
	s.Nil(err)

	detector := NewContentTypeDetector()
	t, err := detector.InferType(fs, ".")
	s.Nil(err)
	s.Equal(&ContentType{
		AppMode:        apptypes.PythonDashMode,
		Entrypoint:     appFilename,
		RequiresPython: true,
	}, t)
}

func (s *AllSuite) TestInferTypeDirectoryIndeterminate() {
	fs := afero.NewMemMapFs()

	filename := "myfile"
	err := afero.WriteFile(fs, filename, []byte("This is a text file, silly!\n"), 0600)
	s.Nil(err)

	detector := NewContentTypeDetector()
	t, err := detector.InferType(fs, ".")
	s.NotNil(err)
	s.ErrorIs(err, errCantDetectContentType)
	s.Nil(t)
}

func (s *AllSuite) TestInferTypeFileIndeterminate() {
	fs := afero.NewMemMapFs()

	filename := "myfile"
	err := afero.WriteFile(fs, filename, []byte("This is a text file, silly!\n"), 0600)
	s.Nil(err)

	detector := NewContentTypeDetector()
	t, err := detector.InferType(fs, filename)
	s.NotNil(err)
	s.ErrorIs(err, errCantDetectContentType)
	s.Nil(t)
}

func (s *AllSuite) TestInferTypeErr() {
	fs := afero.NewMemMapFs()
	detector := NewContentTypeDetector()
	t, err := detector.InferType(fs, "/foo")
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(t)
}
