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

type ShinySuite struct {
	utiltest.Suite
}

func TestShinySuite(t *testing.T) {
	suite.Run(t, new(ShinySuite))
}

func (s *ShinySuite) TestInferTypeAppR() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "app.R"
	path := base.Join(filename)
	err = path.WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewRShinyDetector()
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRShiny,
		Title:      "",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{},
		R:          &config.R{},
	}, configs[0])
}

func (s *ShinySuite) TestInferTypeServerR() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "server.R"
	path := base.Join(filename)
	err = path.WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewRShinyDetector()
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRShiny,
		Title:      "",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{},
		R:          &config.R{},
	}, configs[0])
}

func (s *ShinySuite) TestInferTypeNone() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	detector := NewRShinyDetector()
	t, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Nil(t)
}

func (s *ShinySuite) TestInferTypeWithEntrypoint() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "server.R"
	err = base.Join(filename).WriteFile(nil, 0600)
	s.Nil(err)

	otherFilename := "app.R"
	err = base.Join(otherFilename).WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewRShinyDetector()
	entrypoint := util.NewRelativePath(filename, base.Fs())
	configs, err := detector.InferType(base, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRShiny,
		Title:      "",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{},
		R:          &config.R{},
	}, configs[0])
}
