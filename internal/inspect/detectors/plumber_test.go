package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type PlumberSuite struct {
	utiltest.Suite
	testdataBase util.AbsolutePath
}

func TestPlumberSuite(t *testing.T) {
	suite.Run(t, new(PlumberSuite))
}

func (s *PlumberSuite) projectSetup(pdir string) {
	realCwd, err := util.Getwd(nil)
	s.NoError(err)

	s.testdataBase = realCwd.Join("testdata", pdir)
}

func (s *PlumberSuite) TestInferTypePlumberR() {
	s.projectSetup("plumber-r")
	entrypoint := util.NewRelativePath("plumber.R", nil)

	detector := NewPlumberDetector(logging.New())
	configs, err := detector.InferType(s.testdataBase, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: "plumber.R",
		Validate:   &validate,
		Files:      []string{"/plumber.R"},
		R:          &config.R{},
	}, configs[0])
}

func (s *PlumberSuite) TestInferTypeEntrypointR() {
	s.projectSetup("plumber-entrypoint-r")
	entrypoint := util.NewRelativePath("entrypoint.R", nil)

	detector := NewPlumberDetector(logging.New())
	configs, err := detector.InferType(s.testdataBase, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: "entrypoint.R",
		Validate:   &validate,
		Files:      []string{"/entrypoint.R"},
		R:          &config.R{},
	}, configs[0])
}

func (s *PlumberSuite) TestInferTypeNone() {
	s.projectSetup("rmd-static-1")
	entrypoint := util.NewRelativePath("static.Rmd", nil)

	detector := NewPlumberDetector(logging.New())
	t, err := detector.InferType(s.testdataBase, entrypoint)
	s.Nil(err)
	s.Nil(t)
}

func (s *PlumberSuite) TestInferTypeWithServerYml() {
	s.projectSetup("plumber-server-yml")
	entrypoint := util.NewRelativePath("app.R", nil)

	detector := NewPlumberDetector(logging.New())
	configs, err := detector.InferType(s.testdataBase, entrypoint)
	s.NoError(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: "app.R",
		Validate:   &validate,
		Files: []string{
			"/_server.yml",
			"/app/plumber.R",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *PlumberSuite) TestInferTypeWithServerYml_MultiRoutes() {
	// Also using "yaml" extension here to test that case.
	s.projectSetup("plumber-server-yml-multiroutes")
	entrypoint := util.NewRelativePath("app.R", nil)

	detector := NewPlumberDetector(logging.New())
	configs, err := detector.InferType(s.testdataBase, entrypoint)
	s.NoError(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: "app.R",
		Validate:   &validate,
		Files: []string{
			"/_server.yaml",
			"/app/one.R",
			"/app/two.R",
			"/app/three.R",
		},
		R: &config.R{},
	}, configs[0])
}

func (s *PlumberSuite) TestInferTypeServerYmlAsEntrypoint() {
	// Also using "yaml" extension here to test that case.
	s.projectSetup("plumber-server-yml-multiroutes")
	entrypoint := util.NewRelativePath("_server.yaml", nil)

	detector := NewPlumberDetector(logging.New())
	configs, err := detector.InferType(s.testdataBase, entrypoint)
	s.NoError(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeRPlumber,
		Title:      "",
		Entrypoint: "_server.yaml",
		Validate:   &validate,
		Files: []string{
			"/_server.yaml",
			"/app/one.R",
			"/app/two.R",
			"/app/three.R",
		},
		R: &config.R{},
	}, configs[0])
}
