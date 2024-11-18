package renv

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"testing"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type ManifestPackagesSuite struct {
	utiltest.Suite
	testdata util.AbsolutePath
}

func TestManifestPackagesSuite(t *testing.T) {
	suite.Run(t, new(ManifestPackagesSuite))
}

func (s *ManifestPackagesSuite) SetupTest() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	s.testdata = cwd.Join("testdata")
}

type mockPackageLister struct {
	mock.Mock
}

func (m *mockPackageLister) ListAvailablePackages(repos []Repository, log logging.Logger) ([]AvailablePackage, error) {
	args := m.Called(repos, log)
	pkgs := args.Get(0)
	if pkgs == nil {
		return nil, args.Error(1)
	} else {
		return pkgs.([]AvailablePackage), args.Error(1)
	}
}

func (m *mockPackageLister) GetBioconductorRepos(base util.AbsolutePath, log logging.Logger) ([]Repository, error) {
	args := m.Called(base, log)
	repos := args.Get(0)
	if repos == nil {
		return nil, args.Error(1)
	} else {
		return repos.([]Repository), args.Error(1)
	}
}

func (m *mockPackageLister) GetLibPaths(log logging.Logger) ([]util.AbsolutePath, error) {
	args := m.Called(log)
	paths := args.Get(0)
	if paths == nil {
		return nil, args.Error(1)
	} else {
		return paths.([]util.AbsolutePath), args.Error(1)
	}
}

func (s *ManifestPackagesSuite) TestCRAN() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")
	otherlibPath := util.NewAbsolutePath("/nonexistent", afero.NewMemMapFs())

	mapper := NewPackageMapper(base, util.Path{})
	lister := &mockPackageLister{}
	lister.On("GetLibPaths", mock.Anything).Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything, mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything, mock.Anything).Return([]AvailablePackage{
		{
			Name:       "random_package",
			Version:    "4.5.6",
			Repository: "https://cran.example.com",
		},
		{
			Name:       "mypkg",
			Version:    "1.2.3",
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath, logging.New())
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	s.Equal(expected, manifestPackages)
}

func (s *ManifestPackagesSuite) TestBioconductor() {
	base := s.testdata.Join("bioc_project")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")
	otherlibPath := util.NewAbsolutePath("/nonexistent", afero.NewMemMapFs())

	mapper := NewPackageMapper(base, util.Path{})
	lister := &mockPackageLister{}
	lockfileRepos := []Repository{
		{Name: "CRAN", URL: "https://cran.rstudio.com"},
	}
	biocRepos := []Repository{
		{Name: "BioCsoft", URL: "https://bioconductor.org/packages/3.18/bioc"},
		{Name: "BioCann", URL: "https://bioconductor.org/packages/3.18/data/annotation"},
		{Name: "BioCexp", URL: "https://bioconductor.org/packages/3.18/data/experiment"},
		{Name: "BioCworkflows", URL: "https://bioconductor.org/packages/3.18/workflows"},
		{Name: "BioCbooks", URL: "https://bioconductor.org/packages/3.18/books"},
	}
	lister.On("GetLibPaths", mock.Anything).Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything, mock.Anything).Return(biocRepos, nil)
	lister.On("ListAvailablePackages", lockfileRepos, mock.Anything).Return([]AvailablePackage{
		{
			Name:       "random_package",
			Version:    "4.5.6",
			Repository: "https://cran.example.com",
		},
		{
			Name:       "mypkg",
			Version:    "1.2.3",
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	lister.On("ListAvailablePackages", biocRepos, mock.Anything).Return([]AvailablePackage{
		{
			Name:       "bioassayR",
			Version:    "1.40.0",
			Repository: "https://bioconductor.org/packages/3.18/bioc",
		},
		{
			Name:       "Biobase",
			Version:    "2.62.0",
			Repository: "https://bioconductor.org/packages/3.18/bioc",
		},
		{
			Name:       "biobroom",
			Version:    "1.34.0",
			Repository: "https://bioconductor.org/packages/3.18/bioc",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath, logging.New())
	s.NoError(err)

	var expected bundles.PackageMap
	expectedFile := base.Join("expected.json")
	content, err := expectedFile.ReadFile()
	s.NoError(err)
	err = json.Unmarshal(content, &expected)
	s.NoError(err)

	s.Equal(expected, manifestPackages)
}

func (s *ManifestPackagesSuite) TestVersionMismatch() {
	base := s.testdata.Join("version_mismatch")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")

	mapper := NewPackageMapper(base, util.Path{})
	lister := &mockPackageLister{}
	lister.On("GetLibPaths", mock.Anything).Return([]util.AbsolutePath{libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything, mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything, mock.Anything).Return([]AvailablePackage{
		{
			Name:       "mypkg",
			Version:    "1.2.3",
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath, logging.New())
	s.NotNil(err)
	s.Nil(manifestPackages)

	aerr, isAgentErr := types.IsAgentError(err)
	s.Equal(isAgentErr, true)
	s.Equal(aerr.Code, types.ErrorRenvPackageVersionMismatch)
	s.Equal(aerr.Message, "Package mypkg: versions in lockfile '1.2.3' and library '4.5.6' are out of sync. Use renv::restore() or renv::snapshot() to synchronize.")
}

func (s *ManifestPackagesSuite) TestDevVersion() {
	base := s.testdata.Join("dev_version")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")

	mapper := NewPackageMapper(base, util.Path{})
	lister := &mockPackageLister{}
	lister.On("GetLibPaths", mock.Anything).Return([]util.AbsolutePath{libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything, mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything, mock.Anything).Return([]AvailablePackage{
		{
			Name:       "mypkg",
			Version:    "1.0.0", // installed version is newer than this
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath, logging.New())
	s.NotNil(err)
	s.Nil(manifestPackages)

	aerr, isAgentErr := types.IsAgentError(err)
	s.Equal(isAgentErr, true)
	s.Equal(aerr.Code, types.ErrorRenvPackageSourceMissing)
	s.Equal(aerr.Message, "Cannot re-install packages installed from source; all packages must be installed from a reproducible location such as a repository. Package mypkg, Version 1.2.3.")
}

func (s *ManifestPackagesSuite) TestMissingDescriptionFile() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewPackageMapper(base, util.Path{})
	lister := &mockPackageLister{}
	lister.On("GetLibPaths", mock.Anything).Return([]util.AbsolutePath{}, nil)
	lister.On("GetBioconductorRepos", mock.Anything, mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything, mock.Anything).Return([]AvailablePackage{
		{
			Name:       "mypkg",
			Version:    "1.0.0", // installed version is newer than this
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath, logging.New())
	s.NotNil(err)
	s.ErrorIs(err, errPackageNotFound)
	s.Nil(manifestPackages)
}
