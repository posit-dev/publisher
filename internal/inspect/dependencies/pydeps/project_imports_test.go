package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

	cwd, err := util.Getwd(nil)
	s.NoError(err)
	path := cwd.Join("testdata")

	importNames, err := scanner.ScanProjectImports(path)
	s.NoError(err)
	s.Equal([]ImportName{
		"numpy",
		"scipy",
		"that",
	}, importNames)
}
