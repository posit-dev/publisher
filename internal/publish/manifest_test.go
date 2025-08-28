package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/dcf"
)

type ManifestSuite struct {
	suite.Suite
}

type mockManifestPackageMapper struct {
	mock.Mock
}

func (m *mockManifestPackageMapper) GetManifestPackages(base util.AbsolutePath, lockfilePath util.AbsolutePath, log logging.Logger) (bundles.PackageMap, error) {
	args := m.Called(base, lockfilePath, log)
	return args.Get(0).(bundles.PackageMap), args.Error(1)
}

func (m *mockManifestPackageMapper) ScanDependencies(paths []string, log logging.Logger) (util.AbsolutePath, error) {
	args := m.Called(paths, log)
	return args.Get(0).(util.AbsolutePath), args.Error(1)
}

func TestManifestSuite(t *testing.T) {
	suite.Run(t, new(ManifestSuite))
}

func (s *ManifestSuite) TestCreateManifest() {
	log := logging.New()
	emitter := events.NewNullEmitter()
	packageMapper := &mockManifestPackageMapper{}

	// Create a config with R configuration
	cfg := &config.Config{
		R: &config.R{},
	}

	stateStore := &state.State{
		Config: cfg,
	}
	helper := publishhelper.NewPublishHelper(stateStore, log)

	publisher := &defaultPublisher{
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageMapper,
		PublishHelper:  helper,
	}

	// Mock the getRPackages call
	expectedPackages := bundles.PackageMap{
		"testpkg": bundles.Package{
			Description: dcf.Record{
				"Package": "testpkg",
				"Version": "1.0.0",
			},
		},
	}
	packageMapper.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything).Return(expectedPackages, nil)

	manifest, err := publisher.createManifest()

	s.NoError(err)
	s.NotNil(manifest)
	s.Equal(expectedPackages, manifest.Packages)
}
