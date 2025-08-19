package publish

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/publish/publishhelper"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
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

	expectedLockfilePath := s.dirPath.Join("renv.lock")

	// With EMPTY package file
	s.stateStore.Config = &config.Config{
		R: &config.R{
			PackageFile: "",
		},
	}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages()
	s.NoError(err)
	s.Equal(packageMap, s.successPackageMap)
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_PackageFilePresent() {
	// Log only called on success
	s.log.On("Info", "Done collecting R package descriptions").Return()

	expectedLockfilePath := s.dirPath.Join("custom.lock")

	// With a package file
	s.stateStore.Config = &config.Config{
		R: &config.R{
			PackageFile: "custom.lock",
		},
	}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(s.successPackageMap, nil)

	publisher := s.makePublisher()
	packageMap, err := publisher.getRPackages()
	s.NoError(err)
	s.Equal(packageMap, s.successPackageMap)
	s.log.AssertExpectations(s.T())
}

func (s *RPackageDescSuite) TestGetRPackages_ScanPackagesError() {
	expectedLockfilePath := s.dirPath.Join("custom.lock")
	expectedPkgsErr := errors.New("chair is required to reach the top shelf")

	// With a package file
	s.stateStore.Config = &config.Config{
		R: &config.R{
			PackageFile: "custom.lock",
		},
	}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(bundles.PackageMap{}, expectedPkgsErr)

	publisher := s.makePublisher()
	_, err := publisher.getRPackages()
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

	// With a package file
	s.stateStore.Config = &config.Config{
		R: &config.R{
			PackageFile: "custom.lock",
		},
	}

	s.packageMapper.On("GetManifestPackages", s.dirPath, expectedLockfilePath).Return(bundles.PackageMap{}, expectedPkgsAgentErr)

	publisher := s.makePublisher()
	_, err := publisher.getRPackages()
	s.NotNil(err)
	s.Equal(err.(*types.AgentError).Message, "Bad package version, this is a known failure.")
	s.log.AssertExpectations(s.T())
}
