package publish

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/dcf"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type RPackageDescSuite struct {
	utiltest.Suite
	log               *loggingtest.MockLogger
	stateStore        *state.State
	emitter           events.Emitter
	packageMapper     *mockPackageMapper
	successPackageMap bundles.PackageMap
	dirPath           util.AbsolutePath
}

func TestRPackageDescSuite(t *testing.T) {
	suite.Run(t, new(RPackageDescSuite))
}

func (s *RPackageDescSuite) makePublisher() *defaultPublisher {
	helper := publishhelper.NewPublishHelper(s.stateStore, s.log)
	return &defaultPublisher{
		log:            s.log,
		emitter:        s.emitter,
		rPackageMapper: s.packageMapper,
		PublishHelper:  helper,
	}
}

func (s *RPackageDescSuite) SetupTest() {
	s.stateStore = state.Empty()
	s.emitter = events.NewCapturingEmitter()
	s.packageMapper = &mockPackageMapper{}
	s.log = loggingtest.NewMockLogger()

	s.log.On("WithArgs", logging.LogKeyOp, events.PublishGetRPackageDescriptionsOp).Return(s.log)
	s.log.On("Info", "Collecting R package descriptions").Return()
	s.log.On("Debug", "Collecting manifest R packages", "lockfile", mock.Anything).Return()

	s.dirPath = util.NewAbsolutePath("bundles-rpackages-test-path", afero.NewMemMapFs())
	s.stateStore.Dir = s.dirPath

	s.successPackageMap = bundles.PackageMap{
		"R6": bundles.Package{
			Source:      "r6-source",
			Repository:  "r6-repo",
			Description: dcf.Record{},
		},
		"bslib": bundles.Package{
			Source:      "bslib-source",
			Repository:  "bslib-repo",
			Description: dcf.Record{},
		},
	}
}

func (s *RPackageDescSuite) TestGetRPackages() {
	// Log only called on success
	s.log.On("Info", "Done collecting R package descriptions").Return()
	s.log.On("Info", "Loading packages from local R library").Return()

	expectedLockfilePath := s.dirPath.Join("renv.lock")

	// Explicitly set package file so non-scan path is used; create lockfile
	_ = expectedLockfilePath.WriteFile([]byte(`{}`), 0644)
	s.stateStore.Config = &config.Config{R: &config.R{PackageFile: "renv.lock"}}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages(false)
	s.NoError(err)
	s.Equal(packageMap, s.successPackageMap)
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_PackageFilePresent() {
	// Log only called on success
	s.log.On("Info", "Done collecting R package descriptions").Return()
	s.log.On("Info", "Loading packages from local R library").Return()

	expectedLockfilePath := s.dirPath.Join("custom.lock")

	// With a package file; create it so existence check passes
	_ = expectedLockfilePath.WriteFile([]byte(`{}`), 0644)
	s.stateStore.Config = &config.Config{R: &config.R{PackageFile: "custom.lock"}}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages(false)
	s.NoError(err)
	s.Equal(packageMap, s.successPackageMap)
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_ScanPackagesError() {
	expectedLockfilePath := s.dirPath.Join("custom.lock")
	expectedPkgsErr := errors.New("chair is required to reach the top shelf")

	// With a package file that exists
	_ = expectedLockfilePath.WriteFile([]byte(`{}`), 0644)
	s.stateStore.Config = &config.Config{R: &config.R{PackageFile: "custom.lock"}}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(bundles.PackageMap{}, expectedPkgsErr)

	s.log.On("Info", "Loading packages from local R library").Return()
	publisher := s.makePublisher()
	_, err := publisher.getRPackages(false)
	s.NotNil(err)
	s.Equal(err.(*types.AgentError).Message, "Could not scan R packages from lockfile: custom.lock, chair is required to reach the top shelf")
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_ScanPackagesKnownAgentError() {
	expectedLockfilePath := s.dirPath.Join("custom.lock")
	expectedPkgsAgentErr := types.NewAgentError(
		types.ErrorRenvPackageVersionMismatch,
		errors.New("bad package version, this is a known failure"),
		nil)

	// With a package file that exists
	_ = expectedLockfilePath.WriteFile([]byte(`{}`), 0644)
	s.stateStore.Config = &config.Config{R: &config.R{PackageFile: "custom.lock"}}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(bundles.PackageMap{}, expectedPkgsAgentErr)

	s.log.On("Info", "Loading packages from local R library").Return()
	publisher := s.makePublisher()
	_, err := publisher.getRPackages(false)
	s.NotNil(err)
	s.Equal(err.(*types.AgentError).Message, "Bad package version, this is a known failure.")
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_ScanDependenciesTrue_UsesScannerLockfile() {
	// Emitted when scanDependencies=true
	s.log.On("Info", "Detect dependencies from project").Return()
	s.log.On("Debug", "Looking up for extra dependencies for content", "type", mock.Anything).Return()
	s.log.On("Debug", "No extra dependencies found to be included").Return()
	s.log.On("Info", "Loading packages from local R library").Return()
	s.log.On("Info", "Done collecting R package descriptions").Return()

	// Configure a specific package file, so we can check that it is not used.
	s.stateStore.Config = &config.Config{
		R: &config.R{
			PackageFile: "renv_default.lock",
		},
	}

	// Scanner returns a fake lockfile path
	generated := s.dirPath.Join("scanned.lock")
	s.packageMapper.On("ScanDependencies", []string{s.dirPath.String()}, mock.Anything).Return(generated, nil)
	// Ensure GetManifestPackages is called with the generated lockfile, not the default
	s.packageMapper.On("GetManifestPackages", s.dirPath, generated).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages(true)
	s.NoError(err)
	s.Equal(s.successPackageMap, packageMap)
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_ScanDependencies_UsesOnlyConfigFiles() {
	// Emitted when scanDependencies=true
	s.log.On("Info", "Detect dependencies from project").Return()
	s.log.On("Debug", "Looking up for extra dependencies for content", "type", mock.Anything).Return()
	s.log.On("Debug", "No extra dependencies found to be included").Return()
	s.log.On("Info", "Loading packages from local R library").Return()
	s.log.On("Info", "Done collecting R package descriptions").Return()

	// Configure specific files; ensure publisher only passes these
	s.stateStore.Config = &config.Config{
		Files: []string{"a.R", "subdir/b.R"},
		R: &config.R{
			PackageFile: "ignored-when-scan.lock",
		},
	}

	// Create the files in the project dir, plus an extra file that should be ignored
	_ = s.dirPath.Join("a.R").WriteFile([]byte("print('a')"), 0644)
	_ = s.dirPath.Join("subdir").MkdirAll(0777)
	_ = s.dirPath.Join("subdir", "b.R").WriteFile([]byte("print('b')"), 0644)
	// This file is NOT in config.Files and must be ignored
	_ = s.dirPath.Join("subdir", "ignored.R").WriteFile([]byte("print('ignored')"), 0644)

	// This are the files we specified in Config.Files and thus we
	// expect will be used.
	expectedPaths := []string{s.dirPath.Join("a.R").String(), s.dirPath.Join("subdir", "b.R").String()}

	// Setup ScanDependencies and GetManifestPackages in a way that they expect
	// expectedPaths to be passed as an argument when publisher.getRPackages
	// is invoked.
	generated := s.dirPath.Join("scanned.lock")
	s.packageMapper.On("ScanDependencies", expectedPaths, mock.Anything).Return(generated, nil)
	s.packageMapper.On("GetManifestPackages", s.dirPath, generated).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages(true)
	s.NoError(err)
	s.Equal(s.successPackageMap, packageMap)
	s.log.AssertExpectations(s.T())
}

// Verifies that when packages_from_library=true, getRPackages emits the
// library-loading log message. This test relies on the mock mapper type,
// which exercises the library branch in getRPackages.
func (s *RPackageDescSuite) TestGetRPackages_LogsLibraryWhenPackagesFromLibraryTrue() {
	// Log only called on success
	s.log.On("Info", "Done collecting R package descriptions").Return()
	s.log.On("Info", "Loading packages from local R library").Return()

	// Set packages_from_library=true in config (2 lines, no helper)
	t := true
	_ = s.dirPath.Join("renv.lock").WriteFile([]byte(`{}`), 0644)
	s.stateStore.Config = &config.Config{R: &config.R{PackagesFromLibrary: &t, PackageFile: "renv.lock"}}

	expectedLockfilePath := s.dirPath.Join("renv.lock")
	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages(false)
	s.NoError(err)
	s.Equal(s.successPackageMap, packageMap)
	s.log.AssertExpectations(s.T())
}

// Lockfile branch: PackagesFromLibrary=false should log lockfile message when using the lockfile mapper.
func (s *RPackageDescSuite) TestGetRPackages_LogsLockfileWhenPackagesFromLibraryFalse() {
	s.log.On("Info", "Done collecting R package descriptions").Return()
	s.log.On("Info", "Loading packages from renv.lock", "lockfile", mock.Anything).Return()
	s.log.On("Debug", "Reading lockfile for package manifest generation", "lockfile", mock.Anything).Return()
	s.log.On("Debug", "Processing packages from lockfile", "package_count", mock.Anything).Return()
	s.log.On("Debug", "Successfully generated manifest packages from lockfile", "manifest_package_count", mock.Anything).Return()

	// Create a minimal renv.lock in the project dir
	lockfile := s.dirPath.Join("renv.lock")
	_ = lockfile.WriteFile([]byte(`{
  "R": {
    "Version": "4.3.0",
    "Repositories": [{"Name":"CRAN","URL":"https://cran.rstudio.com"}]
  },
  "Packages": {
    "R6": {"Package":"R6","Version":"2.5.1","Source":"Repository","Repository":"CRAN","Hash":"abc"}
  }
}`), 0644)

	f := false
	// Configured to use existing lockfile with packages
	s.stateStore.Config = &config.Config{R: &config.R{PackagesFromLibrary: &f, PackageFile: "renv.lock"}}

	// Swap in a real lockfile mapper to exercise the lockfile branch
	helper := publishhelper.NewPublishHelper(s.stateStore, s.log)
	publisher := &defaultPublisher{
		log:            s.log,
		emitter:        s.emitter,
		rPackageMapper: renv.NewLockfilePackageMapper(s.dirPath, util.NewPath("R", s.dirPath.Fs()), s.log),
		PublishHelper:  helper,
	}

	packageMap, err := publisher.getRPackages(false)
	s.NoError(err)
	s.NotNil(packageMap)
	s.Contains(packageMap, "R6")
	s.log.AssertExpectations(s.T())
}

// Lockfile branch default: PackagesFromLibrary=nil should behave like false and log lockfile message.
func (s *RPackageDescSuite) TestGetRPackages_LogsLockfileWhenPackagesFromLibraryNil() {
	s.log.On("Info", "Done collecting R package descriptions").Return()
	s.log.On("Info", "Loading packages from renv.lock", "lockfile", mock.Anything).Return()
	s.log.On("Debug", "Reading lockfile for package manifest generation", "lockfile", mock.Anything).Return()
	s.log.On("Debug", "Processing packages from lockfile", "package_count", mock.Anything).Return()
	s.log.On("Debug", "Successfully generated manifest packages from lockfile", "manifest_package_count", mock.Anything).Return()

	// Ensure a minimal renv.lock exists
	lockfile := s.dirPath.Join("renv.lock")
	_ = lockfile.WriteFile([]byte(`{
  "R": {
    "Version": "4.3.0",
    "Repositories": [{"Name":"CRAN","URL":"https://cran.rstudio.com"}]
  },
  "Packages": {
    "R6": {"Package":"R6","Version":"2.5.1","Source":"Repository","Repository":"CRAN","Hash":"abc"}
  }
}`), 0644)

	// Configured to use existing lockfile with packages
	s.stateStore.Config = &config.Config{R: &config.R{PackagesFromLibrary: nil, PackageFile: "renv.lock"}}

	helper := publishhelper.NewPublishHelper(s.stateStore, s.log)
	publisher := &defaultPublisher{
		log:            s.log,
		emitter:        s.emitter,
		rPackageMapper: renv.NewLockfilePackageMapper(s.dirPath, util.NewPath("R", s.dirPath.Fs()), s.log),
		PublishHelper:  helper,
	}

	packageMap, err := publisher.getRPackages(false)
	s.NoError(err)
	s.NotNil(packageMap)
	s.Contains(packageMap, "R6")
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_IncludesIndirectExtraDependencies() {
	expectedExtraDepsPath := s.dirPath.Join(".posit", "__publisher_deps.R").String()
	expectedExtraDeps := []string{"shiny", "rmarkdown"}

	s.log.On("Info", "Detect dependencies from project").Return()
	s.log.On("Debug", "Looking up for extra dependencies for content", "type", mock.Anything).Return()
	s.log.On("Debug", "Recording extra dependencies file", "file", expectedExtraDepsPath, "dependencies", expectedExtraDeps).Return()
	s.log.On("Debug", "Including extra dependencies file for scanning", "file", expectedExtraDepsPath).Return()
	s.log.On("Info", "Loading packages from local R library").Return()
	s.log.On("Info", "Done collecting R package descriptions").Return()

	// Configure a specific package file, so we can check that it is not used.
	s.stateStore.Config = &config.Config{
		Type: contenttypes.ContentTypeRMarkdownShiny,
		R: &config.R{
			PackageFile: "renv_default.lock",
		},
		Files: []string{"report.Rmd"},
	}

	// Scanner returns a fake lockfile path
	generated := s.dirPath.Join("scanned.lock")
	expectedPathsToScan := []string{
		s.dirPath.Join("report.Rmd").String(),
		expectedExtraDepsPath, // Extra "".../.posit/__publisher_deps.R" deps file must be included for R scanning to pick up indirect deps
	}
	s.packageMapper.On("ScanDependencies", expectedPathsToScan, mock.Anything).Return(generated, nil)
	// Ensure GetManifestPackages is called with the generated lockfile, not the default
	s.packageMapper.On("GetManifestPackages", s.dirPath, generated).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages(true)
	s.NoError(err)
	s.Equal(s.successPackageMap, packageMap)
	s.log.AssertExpectations(s.T())
}
