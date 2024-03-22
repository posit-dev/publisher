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

type PyShinySuite struct {
	utiltest.Suite
}

func TestPyShinySuite(t *testing.T) {
	suite.Run(t, new(PyShinySuite))
}

func (s *PyShinySuite) TestInferType() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "app.py"
	path := base.Join(filename)
	err = path.WriteFile([]byte("import shiny\n"), 0600)
	s.Nil(err)

	detector := NewPyShinyDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonShiny,
		Entrypoint: filename,
		Validate:   true,
		Python:     &config.Python{},
	}, t)
}

func (s *PyShinySuite) TestInferTypeShinyExpress() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "app.py"
	path := base.Join(filename)
	err = path.WriteFile([]byte("import shiny.express\n"), 0600)
	s.Nil(err)

	detector := NewPyShinyDetector()
	t, err := detector.InferType(base)
	s.Nil(err)
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonShiny,
		Entrypoint: "shiny.express.app:app_2e_py",
		Validate:   true,
		Python:     &config.Python{},
	}, t)
}
