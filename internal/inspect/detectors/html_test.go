package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

	detector := NewStaticHTMLDetector(logging.New())
	configs, err := detector.InferType(base, util.RelativePath{})
	s.Nil(err)
	s.Len(configs, 2)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeHTML,
		Entrypoint: filename,
		Validate:   &validate,
		Files:      []string{fmt.Sprintf("/%s", filename)},
	}, configs[0])
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeHTML,
		Entrypoint: otherFilename,
		Validate:   &validate,
		Files:      []string{fmt.Sprintf("/%s", otherFilename)},
	}, configs[1])
}

func (s *StaticHTMLDetectorSuite) TestInferTypeWithEntrypoint() {
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

	detector := NewStaticHTMLDetector(logging.New())
	entrypoint := util.NewRelativePath(otherFilename, base.Fs())
	configs, err := detector.InferType(base, entrypoint)
	s.Nil(err)
	s.Len(configs, 1)

	validate := true
	s.Equal(&config.Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       contenttypes.ContentTypeHTML,
		Entrypoint: otherFilename,
		Validate:   &validate,
		Files:      []string{fmt.Sprintf("/%s", otherFilename)},
	}, configs[0])
}
