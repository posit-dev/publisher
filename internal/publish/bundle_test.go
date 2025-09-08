package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"archive/tar"
	"compress/gzip"
	"io"
	"os"
	"slices"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/dcf"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type BundleSuite struct {
	utiltest.Suite
	log           logging.Logger
	emitter       events.Emitter
	fs            afero.Fs
	stateStore    *state.State
	packageMapper *bundleMockPackageMapper
	dir           util.AbsolutePath
}

func TestBundleSuite(t *testing.T) {
	suite.Run(t, new(BundleSuite))
}

func (s *BundleSuite) SetupTest() {
	// Use an OsFs with a temp directory to ensure Chdir works properly
	_, err := util.Getwd(afero.NewOsFs())
	s.Require().NoError(err)

	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "bundle_test_*")
	s.Require().NoError(err)

	s.fs = afero.NewOsFs()
	s.dir = util.AbsolutePath{Path: util.NewPath(tempDir, s.fs)}

	// Set up mocks and state
	s.log = loggingtest.NewMockLogger()
	s.emitter = events.NewCapturingEmitter()
	s.packageMapper = &bundleMockPackageMapper{}

	// Create state with required properties
	s.stateStore = &state.State{
		Dir:         s.dir,
		AccountName: "test-account",
		ConfigName:  "test-config",
		TargetName:  "test-target",
		SaveName:    "test-save",
		Account: &accounts.Account{
			Name:       "test-account",
			URL:        "https://test-server.com",
			ServerType: server_type.ServerTypeConnect,
		},
		Config: &config.Config{
			Type:       contenttypes.ContentTypeRShiny,
			Entrypoint: "app.R",
			Files:      []string{"*.R", "data/", "www/"},
			R: &config.R{
				Version: "4.2.0",
			},
		},
		Target:  deployment.New(),
		LocalID: "test-local-id",
	}

	// Create some test files in the directory
	s.createTestFiles()

	// Use a discard logger instead of trying to mock all the possible log combinations
	s.log = logging.NewDiscardLogger()

	// Since we're using a discard logger, we need to create a mock packageMapper that doesn't verify the logger
	mockPM := &bundleMockPackageMapper{}
	mockPM.On("GetManifestPackages", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(bundles.PackageMap{}, nil)
	s.packageMapper = mockPM
}

func (s *BundleSuite) createTestFiles() {
	// Create a simple Shiny app
	appR := "print('hi')\n"
	renvLock := `
{
  "R": {
    "Version": "4.3.0",
    "Repositories": [
      {
        "Name": "CRAN",
        "URL": "https://cran.rstudio.com"
      }
    ]
  },
  "Packages": {
    "R6": {
      "Package": "R6",
      "Version": "2.5.1",
      "Source": "Repository",
      "Repository": "CRAN",
      "Requirements": [
        "R"
      ],
      "Hash": "470851b6d5d0ac559e9d01bb352b4021"
    }
  }
}
`

	// Create app.R
	appRPath := s.dir.Join("app.R")
	err := appRPath.WriteFile([]byte(appR), 0644)
	s.NoError(err)

	// Create renv.lock
	renvLockPath := s.dir.Join("renv.lock")
	err = renvLockPath.WriteFile([]byte(renvLock), 0644)
	s.NoError(err)

	// Create data directory with a CSV file
	dataDir := s.dir.Join("data")
	err = dataDir.MkdirAll(0755)
	s.NoError(err)

	dataFilePath := dataDir.Join("test.csv")
	dataContent := "x,y\n1,2\n3,4\n5,6"
	err = dataFilePath.WriteFile([]byte(dataContent), 0644)
	s.NoError(err)

	// Create www directory with a CSS file
	wwwDir := s.dir.Join("www")
	err = wwwDir.MkdirAll(0755)
	s.NoError(err)

	cssFilePath := wwwDir.Join("styles.css")
	cssContent := "body { font-family: Arial, sans-serif; }"
	err = cssFilePath.WriteFile([]byte(cssContent), 0644)
	s.NoError(err)
}

func (s *BundleSuite) createPublisher() *defaultPublisher {
	helper := publishhelper.NewPublishHelper(s.stateStore, s.log)
	return &defaultPublisher{
		log:            s.log,
		emitter:        s.emitter,
		rPackageMapper: s.packageMapper,
		r:              util.NewPath("R", s.fs),
		python:         util.NewPath("python", s.fs),
		PublishHelper:  helper,
	}
}

func (s *BundleSuite) TearDownTest() {
	// Clean up temp directory
	os.RemoveAll(s.dir.String())
}

func (s *BundleSuite) TestCreateBundle() {

	// Create publisher
	publisher := s.createPublisher()

	// No need to mock log calls with discard logger

	// Create the manifest
	manifest, err := publisher.createManifest()
	s.NoError(err)

	// Call createBundle
	bundleFile, err := publisher.createBundle(manifest)
	s.NoError(err)
	defer bundleFile.Close()
	defer os.Remove(bundleFile.Name())

	// Verify bundle file was created
	s.NotNil(bundleFile)

	// Verify the Target.Files field was populated
	s.NotEmpty(publisher.Target.Files)

	// Read the bundle file and verify its contents
	bundleFiles := s.readBundleContents(bundleFile)

	// Verify the bundle contains the expected files
	expectedFiles := []string{
		"app.R",
		"data/",
		"data/test.csv",
		"manifest.json",
		"www/",
		"www/styles.css",
	}
	s.ElementsMatch(expectedFiles, bundleFiles)

	// Verify the Target.Files field contains the expected files
	expectedTargetFiles := []string{
		"app.R",
		"data/test.csv",
		"www/styles.css",
	}
	s.ElementsMatch(expectedTargetFiles, publisher.Target.Files)

	// Verify interpreter details were read and set in Target
	s.Equal(publisher.Target.Renv.R.Version, "4.3.0")
	s.Equal(len(publisher.Target.Renv.R.Repositories), 1)
	s.Equal(publisher.Target.Renv.R.Repositories[0].Name, "CRAN")
	s.Equal(len(publisher.Target.Renv.Packages), 1)
	s.Equal(publisher.Target.Renv.Packages["R6"].Package, renv.PackageName("R6"))

	// Using discard logger - no assertions needed
}

func (s *BundleSuite) TestCreateBundle_IncludesRenvLock_WhenWildcardAndLockExists() {
	// Ensure wildcard includes renv.lock
	s.stateStore.Config.Files = []string{"*"}
	// Simulate earlier detection setting PackageFile
	if s.stateStore.Config.R == nil {
		s.stateStore.Config.R = &config.R{}
	}
	s.stateStore.Config.R.PackageFile = "renv.lock"

	publisher := s.createPublisher()
	manifest, err := publisher.createManifest()
	s.NoError(err)

	bundleFile, err := publisher.createBundle(manifest)
	s.NoError(err)
	defer bundleFile.Close()
	defer os.Remove(bundleFile.Name())

	files := s.readBundleContents(bundleFile)
	s.Contains(files, "renv.lock")
}

func (s *BundleSuite) TestCreateBundle_ExcludesRenvLock_WhenMissingAndWildcard() {
	// Build an isolated temp project without renv.lock
	tmp, err := os.MkdirTemp("", "bundle_test_no_lock_*")
	s.Require().NoError(err)
	defer os.RemoveAll(tmp)

	fs := afero.NewOsFs()
	dir := util.AbsolutePath{Path: util.NewPath(tmp, fs)}

	// Minimal app structure
	_ = dir.Join("app.R").WriteFile([]byte("print('hi')\n"), 0644)
	_ = dir.Join("data").MkdirAll(0755)
	_ = dir.Join("data", "test.csv").WriteFile([]byte("x\ny\n"), 0644)

	// Prepare state with wildcard and empty PackageFile
	cfg := &config.Config{
		Type:       contenttypes.ContentTypeRShiny,
		Entrypoint: "app.R",
		Files:      []string{"*"},
		R:          &config.R{Version: "4.2.0", PackageFile: ""},
	}

	st := &state.State{Dir: dir, Config: cfg}
	helper := publishhelper.NewPublishHelper(st, logging.NewDiscardLogger())

	// Mock mapper to return a generated lockfile and non-empty packages on scan
	mockPM := &bundleMockPackageMapper{}
	generated := dir.Join("generated.lock")
	mockPM.On("ScanDependencies", []string{dir.String()}, mock.Anything).Return(generated, nil)
	pkgs := bundles.PackageMap{"R6": {Description: dcf.Record{"Package": "R6", "Version": "2.5.1"}}}
	mockPM.On("GetManifestPackages", dir, generated, mock.Anything).Return(pkgs, nil)

	pub := &defaultPublisher{
		log:            logging.NewDiscardLogger(),
		emitter:        events.NewNullEmitter(),
		rPackageMapper: mockPM,
		r:              util.NewPath("R", fs),
		python:         util.NewPath("python", fs),
		PublishHelper:  helper,
	}

	manifest, err := pub.createManifest()
	s.NoError(err)
	s.NotEmpty(manifest.Packages)
	// Config.R.PackageFile remains empty
	s.Equal("", pub.Config.R.PackageFile)

	bundleFile, err := pub.createBundle(manifest)
	s.NoError(err)
	defer bundleFile.Close()
	defer os.Remove(bundleFile.Name())

	files := s.readBundleContents(bundleFile)
	// No renv.lock present in project, so it must not appear
	s.NotContains(files, "renv.lock")
}

func (s *BundleSuite) TestFullFlow_WithConfiguredLockfile_UsesItAndBundlesIt() {
	// Local state with wildcard so lockfile is bundled; configure R.PackageFile explicitly
	cfg := &config.Config{
		Type:       contenttypes.ContentTypeRShiny,
		Entrypoint: "app.R",
		Files:      []string{"*"},
		R:          &config.R{Version: "4.2.0", PackageFile: "renv.lock"},
	}

	st := &state.State{Dir: s.dir, Config: cfg}
	helper := publishhelper.NewPublishHelper(st, logging.NewDiscardLogger())

	// Expect to read packages from configured renv.lock without scanning
	lockfile := s.dir.Join("renv.lock")
	expected := bundles.PackageMap{
		"R6": {Description: dcf.Record{"Package": "R6", "Version": "2.5.1"}},
	}
	mockPM := &bundleMockPackageMapper{}
	mockPM.On("GetManifestPackages", s.dir, lockfile, mock.Anything).Return(expected, nil)

	pub := &defaultPublisher{
		log:            logging.NewDiscardLogger(),
		emitter:        events.NewNullEmitter(),
		rPackageMapper: mockPM,
		r:              util.NewPath("R", s.fs),
		python:         util.NewPath("python", s.fs),
		PublishHelper:  helper,
	}

	manifest, err := pub.createManifest()
	s.NoError(err)

	// Packages should be what the mapper returned (no scanning)
	s.Equal(expected, manifest.Packages)
	mockPM.AssertNotCalled(s.T(), "ScanDependencies", mock.Anything, mock.Anything)

	// Bundle should include the lockfile
	bundleFile, err := pub.createBundle(manifest)
	s.NoError(err)
	defer bundleFile.Close()
	defer os.Remove(bundleFile.Name())
	files := s.readBundleContents(bundleFile)
	s.Contains(files, "renv.lock")
}

func (s *BundleSuite) readBundleContents(bundleFile *os.File) []string {
	// Reset file pointer to the beginning
	_, err := bundleFile.Seek(0, io.SeekStart)
	s.NoError(err)

	// Read the bundle's tar.gz content
	gzipReader, err := gzip.NewReader(bundleFile)
	s.NoError(err)
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)

	var files []string
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		s.NoError(err)

		files = append(files, header.Name)
	}

	slices.Sort(files)
	return files
}

// Mock package mapper implementation for bundle tests
type bundleMockPackageMapper struct {
	mock.Mock
}

func (m *bundleMockPackageMapper) GetManifestPackages(dir util.AbsolutePath, lockfilePath util.AbsolutePath, log logging.Logger) (bundles.PackageMap, error) {
	args := m.Called(dir, lockfilePath, log)
	if packages, ok := args.Get(0).(bundles.PackageMap); ok {
		return packages, args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *bundleMockPackageMapper) ScanDependencies(paths []string, log logging.Logger) (util.AbsolutePath, error) {
	args := m.Called(paths, mock.Anything)
	if p, ok := args.Get(0).(util.AbsolutePath); ok {
		return p, args.Error(1)
	}
	return util.AbsolutePath{}, args.Error(1)
}
