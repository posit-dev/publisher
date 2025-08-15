package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type LockfilePackageMapperSuite struct {
	utiltest.Suite
	testdata util.AbsolutePath
	log      logging.Logger
}

func TestLockfilePackageMapperSuite(t *testing.T) {
	suite.Run(t, new(LockfilePackageMapperSuite))
}

func (s *LockfilePackageMapperSuite) SetupTest() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	s.testdata = cwd.Join("testdata")
	s.log = logging.New()
}

func (s *LockfilePackageMapperSuite) TestCRAN() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewLockfilePackageMapper(base, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	// Compare just the Source and Repository, since our lockfile parser can't get all the DESCRIPTION fields
	for pkgName, pkg := range manifestPackages {
		s.Equal(expected[pkgName].Source, pkg.Source)
		s.Equal(expected[pkgName].Repository, pkg.Repository)
		s.Equal(expected[pkgName].Description["Package"], pkg.Description["Package"])
		s.Equal(expected[pkgName].Description["Version"], pkg.Description["Version"])
	}
}

func (s *LockfilePackageMapperSuite) TestBioconductor() {
	base := s.testdata.Join("bioc_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewLockfilePackageMapper(base, s.log)
	manifestPackages, err := mapper.GetManifestPackagesFromLockfile(lockfilePath)
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	// Compare just the Source and Repository, since our lockfile parser can't get all the DESCRIPTION fields
	for pkgName, pkg := range manifestPackages {
		s.Equal(expected[pkgName].Source, pkg.Source)
		s.Equal(expected[pkgName].Repository, pkg.Repository)
		s.Equal(expected[pkgName].Description["Package"], pkg.Description["Package"])
		s.Equal(expected[pkgName].Description["Version"], pkg.Description["Version"])
	}
}