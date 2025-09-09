package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"

	"github.com/spf13/afero"
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

func (s *ManifestSuite) TestCreateManifest_WithoutLockfile_ScansDependencies() {
	log := logging.New()
	emitter := events.NewNullEmitter()
	packageMapper := &mockManifestPackageMapper{}

	// Intentionally reference renv.lock but do not create it, to assert scanning is triggered.
	cfg := &config.Config{
		R: &config.R{PackageFile: "renv.lock"},
	}

	stateStore := &state.State{Config: cfg}
	helper := publishhelper.NewPublishHelper(stateStore, log)

	publisher := &defaultPublisher{
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageMapper,
		PublishHelper:  helper,
	}

	dir := util.NewAbsolutePath("/mem/manifest-test", afero.NewMemMapFs())
	_ = dir.MkdirAll(0o777)
	stateStore.Dir = dir

	// Expect: scanning produces a lockfile and we pass that to GetManifestPackages.
	expectedPackages := bundles.PackageMap{
		"testpkg": bundles.Package{
			Description: dcf.Record{
				"Package": "testpkg",
				"Version": "1.0.0",
			},
		},
	}
	generated := dir.Join("scanned.lock")
	packageMapper.On("ScanDependencies", []string{dir.String()}, mock.Anything).Return(generated, nil)
	packageMapper.On("GetManifestPackages", dir, generated, mock.Anything).Return(expectedPackages, nil)

	manifest, err := publisher.createManifest()

	s.NoError(err)
	s.NotNil(manifest)
	s.Equal(expectedPackages, manifest.Packages)
}

func (s *ManifestSuite) TestCreateManifest_WithLockfile_UsesLockfile() {
	log := logging.New()
	emitter := events.NewNullEmitter()
	packageMapper := &mockManifestPackageMapper{}

	// Provide an explicit lockfile to assert scanning is skipped.
	cfg := &config.Config{
		R: &config.R{PackageFile: "renv.lock"},
	}

	stateStore := &state.State{Config: cfg}
	helper := publishhelper.NewPublishHelper(stateStore, log)

	publisher := &defaultPublisher{
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageMapper,
		PublishHelper:  helper,
	}

	dir := util.NewAbsolutePath("/mem/manifest-test-with", afero.NewMemMapFs())
	_ = dir.MkdirAll(0o777)
	stateStore.Dir = dir

	lockfile := dir.Join("renv.lock")
	_ = lockfile.WriteFile([]byte("{}"), 0o644)

	expectedPackages := bundles.PackageMap{
		"testpkg": bundles.Package{
			Description: dcf.Record{
				"Package": "testpkg",
				"Version": "1.0.0",
			},
		},
	}

	// Expect GetManifestPackages to be called with the explicit lockfile;
	// ScanDependencies must not be invoked in this case.
	packageMapper.On("GetManifestPackages", dir, lockfile, mock.Anything).Return(expectedPackages, nil)

	manifest, err := publisher.createManifest()

	s.NoError(err)
	s.NotNil(manifest)
	s.Equal(expectedPackages, manifest.Packages)
	packageMapper.AssertNotCalled(s.T(), "ScanDependencies", mock.Anything, mock.Anything)
}

func (s *ManifestSuite) TestCreateManifest_EmptyPackageFile_IgnoresUnconfiguredLockfile_ScansDependencies() {
	log := logging.New()
	emitter := events.NewNullEmitter()
	packageMapper := &mockManifestPackageMapper{}

	// packageFile empty: createManifest should NOT try to be smart and detect lockfile; it should scan.
	// If lockfile detection has to happen, it should happen before the manifest is created.
	cfg := &config.Config{R: &config.R{PackageFile: ""}}

	stateStore := &state.State{Config: cfg}
	helper := publishhelper.NewPublishHelper(stateStore, log)

	publisher := &defaultPublisher{
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageMapper,
		PublishHelper:  helper,
	}

	dir := util.NewAbsolutePath("/mem/manifest-empty-detect", afero.NewMemMapFs())
	_ = dir.MkdirAll(0o777)
	stateStore.Dir = dir

	// Create a lockfile on disk, but since packageFile is not configured,
	// the implementation should still scan rather than using it.
	_ = dir.Join("renv.lock").WriteFile([]byte("{}"), 0o644)

	expectedPackages := bundles.PackageMap{
		"testpkg": bundles.Package{Description: dcf.Record{"Package": "testpkg", "Version": "1.0.0"}},
	}
	generated := dir.Join("scanned.lock")
	packageMapper.On("ScanDependencies", []string{dir.String()}, mock.Anything).Return(generated, nil)
	packageMapper.On("GetManifestPackages", dir, generated, mock.Anything).Return(expectedPackages, nil)

	manifest, err := publisher.createManifest()

	s.NoError(err)
	s.NotNil(manifest)
	s.Equal(expectedPackages, manifest.Packages)
	packageMapper.AssertCalled(s.T(), "ScanDependencies", []string{dir.String()}, mock.Anything)
}

func (s *ManifestSuite) TestCreateManifest_EmptyPackageFile_NoLockfile_ScansDependencies() {
	log := logging.New()
	emitter := events.NewNullEmitter()
	packageMapper := &mockManifestPackageMapper{}

	cfg := &config.Config{R: &config.R{PackageFile: ""}}
	stateStore := &state.State{Config: cfg}
	helper := publishhelper.NewPublishHelper(stateStore, log)

	publisher := &defaultPublisher{
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageMapper,
		PublishHelper:  helper,
	}

	// No lockfile present: expect scanning.
	dir := util.NewAbsolutePath("/mem/manifest-empty-scan", afero.NewMemMapFs())
	_ = dir.MkdirAll(0o777)
	stateStore.Dir = dir

	expectedPackages := bundles.PackageMap{
		"testpkg": bundles.Package{Description: dcf.Record{"Package": "testpkg", "Version": "1.0.0"}},
	}
	generated := dir.Join("scanned.lock")
	packageMapper.On("ScanDependencies", []string{dir.String()}, mock.Anything).Return(generated, nil)
	packageMapper.On("GetManifestPackages", dir, generated, mock.Anything).Return(expectedPackages, nil)

	manifest, err := publisher.createManifest()

	s.NoError(err)
	s.NotNil(manifest)
	s.Equal(expectedPackages, manifest.Packages)
}
