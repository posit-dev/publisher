package publish

import (
	"os"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type RPackageDescFunctionalSuite struct {
	suite.Suite
	testProjectDir util.AbsolutePath
	log            logging.Logger
	stateStore     *state.State
	emitter        events.Emitter
}

func TestRPackageDescFunctionalSuite(t *testing.T) {
	// Skip if we're in a CI environment without R installed
	// if os.Getenv("CI") != "" && os.Getenv("R_HOME") == "" {
	// 	t.Skip("Skipping functional R test in CI environment without R")
	// }

	suite.Run(t, new(RPackageDescFunctionalSuite))
}

func (s *RPackageDescFunctionalSuite) SetupTest() {
	// Set up the test directory
	tempDir, err := os.MkdirTemp("", "r-packages-test-*")
	s.Require().NoError(err)

	s.testProjectDir = util.NewAbsolutePath(tempDir, afero.NewOsFs())

	// Set up our test state
	s.stateStore = state.Empty()
	s.stateStore.Dir = s.testProjectDir
	s.emitter = events.NewCapturingEmitter()
	s.log = logging.New()

	// Create minimal renv.lock file in the temp directory
	s.createTestRenvLock()
}

func (s *RPackageDescFunctionalSuite) TearDownTest() {
	os.RemoveAll(s.testProjectDir.String())
}

func (s *RPackageDescFunctionalSuite) createTestRenvLock() {
	// Create a simple but valid renv.lock file
	lockContent := `{
      "R": {
        "Version": "4.2.3",
        "Repositories": [
          {
            "Name": "CRAN",
            "URL": "https://cloud.r-project.org"
          }
        ]
      },
      "Packages": {
        "renv": {
          "Package": "renv",
          "Version": "1.1.4",
          "Source": "Repository",
          "Repository": "CRAN",
          "Hash": "fa15e"
        }
      }
    }`

	lockPath := s.testProjectDir.Join("renv.lock")
	err := lockPath.WriteFile([]byte(lockContent), 0644)
	s.Require().NoError(err)
}

func (s *RPackageDescFunctionalSuite) TestGetRPackagesFunctional() {
	// Configure the state
	s.stateStore.Config = &config.Config{
		R: &config.R{
			PackageFile: "renv.lock",
		},
	}

	mapper, err := renv.NewPackageMapper(s.testProjectDir, util.Path{}, s.log)
	s.Require().NoError(err)

	publisher := &defaultPublisher{
		State:          s.stateStore,
		log:            s.log,
		emitter:        s.emitter,
		rPackageMapper: mapper,
	}

	// Actually call getRPackages
	packageMap, err := publisher.getRPackages()

	// we should have a valid package map
	s.Require().Nil(err)
	s.Require().Contains(packageMap, "renv")

	// And it includes renv
	renvPackage := packageMap["renv"]
	s.Require().Equal("CRAN", renvPackage.Source)
}
