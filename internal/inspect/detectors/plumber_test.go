package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type PlumberSuite struct {
	utiltest.Suite
}

func TestPlumberSuite(t *testing.T) {
	suite.Run(t, new(PlumberSuite))
}

func (s *PlumberSuite) TestInferTypePlumberR() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "plumber.R"
	path := base.Join(filename)
	err = path.WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewPlumberDetector()
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{},
		R:          &config.R{},
	}, configs[0])
}

func (s *PlumberSuite) TestInferTypeEntrypointR() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "entrypoint.R"
	path := base.Join(filename)
	err = path.WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewPlumberDetector()
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{},
		R:          &config.R{},
	}, configs[0])
}

func (s *PlumberSuite) TestInferTypeNone() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	detector := NewPlumberDetector()
	t, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Nil(t)
}

func (s *PlumberSuite) TestInferTypeWithEntrypoint() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "entrypoint.R"
	err = base.Join(filename).WriteFile(nil, 0600)
	s.Nil(err)

	otherFilename := "plumber.R"
	err = base.Join(otherFilename).WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewPlumberDetector()
	entrypoint := util.NewRelativePath(filename, base.Fs())
	configs, err := detector.InferType(base, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{},
		R:          &config.R{},
	}, configs[0])
}
