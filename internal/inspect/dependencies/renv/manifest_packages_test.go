package renv

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"testing"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
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

func (m *mockPackageLister) ListAvailablePackages(repos []Repository) ([]AvailablePackage, error) {
	args := m.Called(repos)
	pkgs := args.Get(0)
	if pkgs == nil {
		return nil, args.Error(1)
	} else {
		return pkgs.([]AvailablePackage), args.Error(1)
	}
}

func (m *mockPackageLister) GetBioconductorRepos(base util.AbsolutePath) ([]Repository, error) {
	args := m.Called(base)
	repos := args.Get(0)
	if repos == nil {
		return nil, args.Error(1)
	} else {
		return repos.([]Repository), args.Error(1)
	}
}

func (m *mockPackageLister) GetLibPaths() ([]util.AbsolutePath, error) {
	args := m.Called()
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

	mapper := NewPackageMapper(base, util.Path{}, logging.New())
	lister := &mockPackageLister{}
	lister.On("GetLibPaths").Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything).Return([]AvailablePackage{
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

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath)
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

	mapper := NewPackageMapper(base, util.Path{}, logging.New())
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
	lister.On("GetLibPaths").Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything).Return(biocRepos, nil)
	lister.On("ListAvailablePackages", lockfileRepos).Return([]AvailablePackage{
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
	lister.On("ListAvailablePackages", biocRepos).Return([]AvailablePackage{
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

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath)
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

	mapper := NewPackageMapper(base, util.Path{}, logging.New())
	lister := &mockPackageLister{}
	lister.On("GetLibPaths").Return([]util.AbsolutePath{libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything).Return([]AvailablePackage{
		{
			Name:       "mypkg",
			Version:    "1.2.3",
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath)
	s.NotNil(err)
	s.ErrorIs(err, errLockfileLibraryMismatch)
	s.Nil(manifestPackages)
}

func (s *ManifestPackagesSuite) TestDevVersion() {
	base := s.testdata.Join("dev_version")
	lockfilePath := base.Join("renv.lock")
	libPath := base.Join("renv_library")

	mapper := NewPackageMapper(base, util.Path{}, logging.New())
	lister := &mockPackageLister{}
	lister.On("GetLibPaths").Return([]util.AbsolutePath{libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything).Return([]AvailablePackage{
		{
			Name:       "mypkg",
			Version:    "1.0.0", // installed version is newer than this
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath)
	s.NotNil(err)
	s.ErrorIs(err, errMissingPackageSource)
	s.Nil(manifestPackages)
}

func (s *ManifestPackagesSuite) TestMissingDescriptionFile() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("renv.lock")

	mapper := NewPackageMapper(base, util.Path{}, logging.New())
	lister := &mockPackageLister{}
	lister.On("GetLibPaths").Return([]util.AbsolutePath{}, nil)
	lister.On("GetBioconductorRepos", mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything).Return([]AvailablePackage{
		{
			Name:       "mypkg",
			Version:    "1.0.0", // installed version is newer than this
			Repository: "https://cran.rstudio.com",
		},
	}, nil)
	mapper.lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath)
	s.NotNil(err)
	s.ErrorIs(err, errPackageNotFound)
	s.Nil(manifestPackages)
}
