package renv

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type ManifestPackagesSuite struct {
	utiltest.Suite
	testdata util.AbsolutePath
	log      logging.Logger
}

func TestManifestPackagesSuite(t *testing.T) {
	suite.Run(t, new(ManifestPackagesSuite))
}

func (s *ManifestPackagesSuite) SetupTest() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	s.testdata = cwd.Join("testdata")
	s.log = logging.New()
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

mapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

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
	mapper.(*defaultPackageMapper).lister = lister

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

mapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

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
	mapper.(*defaultPackageMapper).lister = lister

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

mapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

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
	mapper.(*defaultPackageMapper).lister = lister

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

mapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

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
	mapper.(*defaultPackageMapper).lister = lister

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

mapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

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
	mapper.(*defaultPackageMapper).lister = lister

	manifestPackages, err := mapper.GetManifestPackages(base, lockfilePath, logging.New())
	s.NotNil(err)
	s.ErrorIs(err, errPackageNotFound)
	s.Nil(manifestPackages)
}

func (s *ManifestPackagesSuite) TestMissingLockfile_BubblesUpRenvError() {
	base := s.testdata.Join("cran_project")
	lockfilePath := base.Join("does-not-exist.lock")

mapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

	// Override interpeter factory to use a mock
	renvAgentErr := types.NewAgentError(
		types.ErrorRenvPackageNotInstalled,
		errors.New("package renv is not installed. An renv lockfile is needed for deployment"),
		nil)
	rIntprMock := interpreters.NewMockRInterpreter()
	rIntprMock.On("RenvEnvironmentErrorCheck").Return(renvAgentErr)
	mapper.(*defaultPackageMapper).rInterpreterFactory = func() (interpreters.RInterpreter, error) {
		return rIntprMock, nil
	}

	_, err = mapper.GetManifestPackages(base, lockfilePath, logging.New())
	s.NotNil(err)
	aerr, isAgentErr := types.IsAgentError(err)
	s.Equal(isAgentErr, true)
	s.Equal(aerr.Code, types.ErrorRenvPackageNotInstalled)
}

// scannerAdapter adapts a testify mock to the RDependencyScanner interface for tests
type scannerAdapter struct{ m *mock.Mock }

func (s *scannerAdapter) ScanDependencies(paths []string, rExecutable string) (util.AbsolutePath, error) {
	args := s.m.Called(paths, rExecutable)
	if p, ok := args.Get(0).(util.AbsolutePath); ok {
		return p, args.Error(1)
	}
	return util.AbsolutePath{}, args.Error(1)
}

func (scannerAdapter *scannerAdapter) SetupRenvInDir(targetPath string, lockfile string, rExecutable string) (util.AbsolutePath, error) {
	return util.AbsolutePath{}, nil
}

func (s *ManifestPackagesSuite) TestLockFile_CreateFromScanner() {
	base := s.testdata.Join("cran_project")
	// Generate a lockfile via the scanner and ensure we use it.

mapper, err := NewPackageMapper(base, util.Path{}, s.log, false, nil)
	s.NoError(err)

	// Override scanner to return the known renv.lock in cran_project
	genPath := base.Join("renv.lock")
	m := mapper.(*defaultPackageMapper)
	mm := &mock.Mock{}
	mm.On("ScanDependencies", mock.Anything, mock.Anything).Return(genPath, nil)
	m.scanner = &scannerAdapter{mm}

	// Setup lister
	lister := &mockPackageLister{}
	libPath := base.Join("renv_library")
	otherlibPath := util.NewAbsolutePath("/nonexistent", afero.NewMemMapFs())
	lister.On("GetLibPaths", mock.Anything).Return([]util.AbsolutePath{otherlibPath, libPath}, nil)
	lister.On("GetBioconductorRepos", mock.Anything, mock.Anything).Return(nil, nil)
	lister.On("ListAvailablePackages", mock.Anything, mock.Anything).Return([]AvailablePackage{{
		Name:       "mypkg",
		Version:    "1.2.3",
		Repository: "https://cran.rstudio.com",
	}}, nil)
	m.lister = lister

	// With new API, caller requests scanning first, then passes the generated lockfile.
	genPath2, err := mapper.ScanDependencies([]string{"."}, logging.New())
	s.NoError(err)
	manifestPackages, err := mapper.GetManifestPackages(base, genPath2, logging.New())
	s.NoError(err)
	s.NotEmpty(manifestPackages)
	// Ensure the scanner was indeed invoked
	mm.AssertExpectations(s.T())
}
