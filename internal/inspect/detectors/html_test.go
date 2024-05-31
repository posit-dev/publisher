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

type StaticHTMLDetectorSuite struct {
	utiltest.Suite
}

func TestStaticHTMLDetectorSuite(t *testing.T) {
	suite.Run(t, new(StaticHTMLDetectorSuite))
}

func (s *StaticHTMLDetectorSuite) TestInferType() {
	base := util.NewAbsolutePath("/project", afero.NewMemMapFs())
	err := base.MkdirAll(0777)
	s.NoError(err)

	filename := "index.html"
	path := base.Join(filename)
	err = path.WriteFile([]byte("<html></html>\n"), 0600)
	s.Nil(err)

	otherFilename := "other.html"
	otherPath := base.Join(otherFilename)
	err = otherPath.WriteFile([]byte("<html></html>\n"), 0600)
	s.Nil(err)

	detector := NewStaticHTMLDetector()
	configs, err := detector.InferType(base)
	s.Nil(err)
	s.Len(configs, 2)

	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeHTML,
		Entrypoint: filename,
		Validate:   true,
		Files:      []string{"*"},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       config.ContentTypeHTML,
		Entrypoint: otherFilename,
		Validate:   true,
		Files:      []string{"*"},
	}, configs[1])
}
