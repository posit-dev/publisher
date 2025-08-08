package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

	htmlFilename := "index.html"
	err = base.Join(htmlFilename).WriteFile([]byte("<html></html>\n"), 0600)
	s.NoError(err)

	appFilename := "myapp.py"
	err = base.Join(appFilename).WriteFile([]byte("import dash\n"), 0600)
	s.NoError(err)

	detector := NewContentTypeDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.NoError(err)
	s.Len(configs, 2)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeHTML,
		Entrypoint: "index.html",
		Validate:   &validate,
		Files:      []string{"/index.html"},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonDash,
		Entrypoint: appFilename,
		Validate:   &validate,
		Files:      []string{},
		Python:     &config.Python{},
	}, configs[1])
}

func (s *AllSuite) TestInferTypeDirectoryIndeterminate() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	err = base.Join("myfile").WriteFile([]byte("This is a text file, silly!\n"), 0600)
	s.NoError(err)

	detector := NewContentTypeDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.NoError(err)
	s.Len(configs, 1)
	s.Equal(config.ContentTypeUnknown, configs[0].Type)
}

func (s *AllSuite) TestInferTypeErr() {
	fs := afero.NewMemMapFs()
	detector := NewContentTypeDetector(logging.New())
	base := util.NewAbsolutePath("/foo", fs)
	configs, err := detector.InferType(base, util.RelativePath{})
	s.NotNil(err)
	s.ErrorIs(err, os.ErrNotExist)
	s.Nil(configs)
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
	t, err := detector.InferType(base, util.RelativePath{})
	s.NoError(err)
	validate := true
	s.Equal([]*config.Config{
		{
			Schema:     schema.ConfigSchemaURL,
			Type:       config.ContentTypePythonDash,
			Entrypoint: appFilename,
			Validate:   &validate,
			Files:      []string{},
			Python:     &config.Python{},
		},
		{
			Schema:     schema.ConfigSchemaURL,
			Type:       config.ContentTypeHTML,
			Entrypoint: "myfile.html",
			Validate:   &validate,
			Files:      []string{"/myfile.html"},
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
	configs, err := detector.InferType(base, util.RelativePath{})
	s.NoError(err)

	s.Len(configs, 1)
	s.Equal(config.ContentTypeUnknown, configs[0].Type)
}
