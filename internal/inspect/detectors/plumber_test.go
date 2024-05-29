package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
		R:          &config.R{},
	}, configs[0])
}

func (s *PlumberSuite) TestInferTypeNone() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	detector := NewPlumberDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Nil(t)
}
