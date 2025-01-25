package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ProjectDependenciesSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	fs  afero.Fs
}

func TestProjectDependenciesSuite(t *testing.T) {
	suite.Run(t, new(ProjectDependenciesSuite))
}

func (s *ProjectDependenciesSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *ProjectDependenciesSuite) TestNewProjectImportScanner() {
	log := logging.New()
	scanner := NewProjectImportScanner(log)
	s.NotNil(scanner.scanner)
	s.Equal(log, scanner.log)
}

func (s *ProjectDependenciesSuite) TestGetRequirementsFilePath() {
	// Test requirements.txt exists
	filePath := s.cwd.Join("requirements.txt")
	filePath.WriteFile([]byte("# leading comment\nnumpy==1.26.1\n  \npandas\n    # indented comment\n"), 0777)

	rel, exists, err := GetRequirementsFilePath(s.cwd)
	s.NoError(err)
	s.Equal(true, exists)
	s.Equal("requirements.txt", rel.String())

	// Test requirements.txt doesn't exist
	bogus := s.cwd.Join("bogus")
	rel, exists, err = GetRequirementsFilePath(bogus)
	s.NoError(err)
	s.Equal(false, exists)
	s.Equal("requirements.txt", rel.String())
}

func (s *ProjectDependenciesSuite) TestReadRequirementsFile() {
	filePath := s.cwd.Join("requirements.txt")
	filePath.WriteFile([]byte("# leading comment\nnumpy==1.26.1\n  \npandas\n    # indented comment\n"), 0777)

	reqs, err := ReadRequirementsFile(filePath)
	s.NoError(err)
	s.Equal([]string{
		"numpy==1.26.1",
		"pandas",
	}, reqs)
}

func (s *ProjectDependenciesSuite) TestWriteRequirementsFile() {
	filePath := s.cwd.Join("requirements.txt")

	contents := []string{
		"numpy==1.26.1",
		"pandas",
	}
	err := WriteRequirementsFile(filePath, contents, util.NewAbsolutePath("/usr/bin/myPython", nil))
	s.NoError(err)

	fileContents, err := ReadRequirementsFile(filePath)
	s.NoError(err)

	s.Equal(contents, fileContents)
}
