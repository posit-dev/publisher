package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/util"
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
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	htmlFilename := "myfile.html"
	err = base.Join(htmlFilename).WriteFile([]byte("<html></html>\n"), 0600)
	s.NoError(err)

	appFilename := "myapp.py"
	err = base.Join(appFilename).WriteFile([]byte("import dash\n"), 0600)
	s.NoError(err)

	detector := NewContentTypeDetector(logging.New())
	t, err := detector.InferType(base)
	s.NoError(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonDash,
		Entrypoint: appFilename,
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
	}, t)
}

func (s *AllSuite) TestInferTypeDirectoryPriority() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	htmlFilename := "myfile.html"
	err = base.Join(htmlFilename).WriteFile([]byte("<html></html>\n"), 0600)
	s.NoError(err)

	appFilename := "myapp.py"
	err = base.Join(appFilename).WriteFile([]byte("import dash\n"), 0600)
	s.NoError(err)

	detector := NewContentTypeDetector(logging.New())
	t, err := detector.InferType(base)
	s.NoError(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonDash,
		Entrypoint: appFilename,
		Validate:   true,
		Files:      []string{"*"},
		Python:     &config.Python{},
	}, t)
}

func (s *AllSuite) TestInferTypeDirectoryIndeterminate() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	err = base.Join("myfile").WriteFile([]byte("This is a text file, silly!\n"), 0600)
	s.NoError(err)

	detector := NewContentTypeDetector(logging.New())
	t, err := detector.InferType(base)
	s.NoError(err)
	s.Equal(config.ContentTypeUnknown, t.Type)
}

func (s *AllSuite) TestInferTypeErr() {
	fs := afero.NewMemMapFs()
	detector := NewContentTypeDetector(logging.New())
	base := util.NewAbsolutePath("/foo", fs)
	t, err := detector.InferType(base)
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(t)
}

func (s *AllSuite) TestInferAll() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	htmlFilename := "myfile.html"
	err = base.Join(htmlFilename).WriteFile([]byte("<html></html>\n"), 0600)
	s.NoError(err)

	appFilename := "myapp.py"
	err = base.Join(appFilename).WriteFile([]byte("import dash\n"), 0600)
	s.NoError(err)

	detector := NewContentTypeDetector(logging.New())
	t, err := detector.InferAll(base)
	s.NoError(err)
	s.Equal([]*config.Config{
		{
			Schema:     schema.ConfigSchemaURL,
			Type:       config.ContentTypePythonDash,
			Entrypoint: appFilename,
			Validate:   true,
			Files:      []string{"*"},
			Python:     &config.Python{},
		},
		{
			Schema:     schema.ConfigSchemaURL,
			Type:       config.ContentTypeHTML,
			Entrypoint: "myfile.html",
			Validate:   true,
			Files:      []string{"*"},
			Python:     nil,
		},
	}, t)
}

func (s *AllSuite) TestInferAllIndeterminate() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	err = base.Join("myfile").WriteFile([]byte("This is a text file, silly!\n"), 0600)
	s.NoError(err)

	detector := NewContentTypeDetector(logging.New())
	configs, err := detector.InferAll(base)
	s.NoError(err)

	s.Len(configs, 1)
	s.Equal(config.ContentTypeUnknown, configs[0].Type)
}
