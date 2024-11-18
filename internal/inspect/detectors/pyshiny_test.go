package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonShiny,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{fmt.Sprintf("/%s", filename)},
		Python:     &config.Python{},
	}, configs[0])
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
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonShiny,
		Entrypoint: "shiny.express.app:app_2e_py",
		Validate:   true,
		Files:      []string{fmt.Sprintf("/%s", filename)},
		Python:     &config.Python{},
	}, configs[0])
}

func (s *PyShinySuite) TestInferTypeWithEntrypoint() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "myapp.py"
	err = base.Join(filename).WriteFile([]byte("import shiny\n"), 0600)
	s.Nil(err)

	otherFilename := "app.py"
	err = base.Join(otherFilename).WriteFile([]byte("import shiny\n"), 0600)
	s.Nil(err)

	detector := NewPyShinyDetector()
	entrypoint := util.NewRelativePath(filename, base.Fs())
	configs, err := detector.InferType(base, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonShiny,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{fmt.Sprintf("/%s", filename)},
		Python:     &config.Python{},
	}, configs[0])
}

func (s *PyShinySuite) TestInferTypeWithExtraFile() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "app.py"
	path := base.Join(filename)
	err = path.WriteFile([]byte("import shiny\n"), 0600)
	s.Nil(err)

	err = base.Join("extra.py").WriteFile(nil, 0600)
	s.Nil(err)

	detector := NewPyShinyDetector()
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 1)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypePythonShiny,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{fmt.Sprintf("/%s", filename)},
		Python:     &config.Python{},
	}, configs[0])
}
