package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRShiny,
		Title:      "",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
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
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeRShiny,
		Title:      "",
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
		R:          &config.R{},
	}, configs[0])
}

func (s *ShinySuite) TestInferTypeNone() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	detector := NewRShinyDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Nil(t)
}
