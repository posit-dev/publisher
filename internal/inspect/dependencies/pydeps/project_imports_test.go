package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ProjectDepsSuite struct {
	utiltest.Suite
}

func TestProjectDepsSuite(t *testing.T) {
	suite.Run(t, new(ProjectDepsSuite))
}

func (s *ProjectDepsSuite) TestNewProjectImportScanner() {
	log := logging.New()
	scanner := NewProjectImportScanner(log)
	s.NotNil(scanner.scanner)
	s.Equal(log, scanner.log)
}

func (s *ProjectDepsSuite) TestScanProjectImports() {
	log := logging.New()
	scanner := NewProjectImportScanner(log)

	path, err := util.NewPath("testdata", nil).Abs()
	s.NoError(err)

	importNames, err := scanner.ScanProjectImports(path)
	s.NoError(err)
	s.Equal([]ImportName{
		"numpy",
		"scipy",
		"that",
	}, importNames)
}
