package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type RPublishFunctionalSuite struct {
	suite.Suite
	testProjectDir util.AbsolutePath
	log            logging.Logger
	stateStore     *state.State
	emitter        events.Emitter
	rExecutable    util.AbsolutePath
	renvInstalled  bool
}

func TestRPublishFunctionalSuite(t *testing.T) {
	suite.Run(t, new(RPublishFunctionalSuite))
}

// skipIfNoR skips the current test if R executable is not available,
// unless we're running in CI where we should enforce that R tests run
func (s *RPublishFunctionalSuite) skipIfNoR() bool {
	if os.Getenv("GITHUB_ACTIONS") != "true" && s.rExecutable.String() == "" {
		s.T().Skip("Skipping test: R executable not found")
		return true
	}
	return false
}

func (s *RPublishFunctionalSuite) SetupTest() {
	// Set up the test directory
	parentDir, err := os.MkdirTemp("", "r-packages-test-*")
	s.Require().NoError(err)

	// Create a subdirectory with spaces in the name
	dirWithSpaces := filepath.Join(parentDir, "With Spaces")
	err = os.MkdirAll(dirWithSpaces, 0755)
	s.Require().NoError(err)

	s.testProjectDir = util.NewAbsolutePath(dirWithSpaces, afero.NewOsFs())

	// Set up our test state
	s.stateStore = state.Empty()
	s.stateStore.Dir = s.testProjectDir
	s.emitter = events.NewCapturingEmitter()
	s.log = logging.New()

	// Create minimal renv.lock file in the temp directory
	s.createTestRenvLock()

	// Initialize R interpreter and check for R executable and renv availability
	rInterpreter, err := interpreters.NewRInterpreter(s.testProjectDir, util.Path{}, s.log, nil, nil, nil)
	s.Require().NoError(err)

	// Try to get R executable
	s.rExecutable, err = rInterpreter.GetRExecutable()
	if err != nil {
		s.T().Logf("R executable not found: %v", err)
		// Not failing here, individual tests will skip if needed
	} else {
		s.T().Logf("Using R executable: %s", s.rExecutable)

		// Check if renv is installed using RenvEnvironmentErrorCheck
		// If no error or error is not about renv installation, then renv is available
		err := rInterpreter.RenvEnvironmentErrorCheck()
		if err == nil {
			s.renvInstalled = true
			s.T().Logf("renv is installed and available")
		} else if _, isRenvNotInstalled := types.IsAgentErrorOf(err, types.ErrorRenvPackageNotInstalled); isRenvNotInstalled {
			s.renvInstalled = false
			s.T().Logf("renv is not installed: %v", err)
		} else {
			// Other errors with renv status, but renv itself is installed
			s.renvInstalled = true
			s.T().Logf("renv is installed but has issues: %v", err)
		}
	}
}

func (s *RPublishFunctionalSuite) TearDownTest() {
	parentDir := filepath.Dir(s.testProjectDir.String())
	os.RemoveAll(parentDir)
}

func (s *RPublishFunctionalSuite) createTestRenvLock() {
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

func (s *RPublishFunctionalSuite) TestGetRPackagesFunctional() {
	if s.skipIfNoR() {
		return
	}

	// Configure the state
	s.stateStore.Config = &config.Config{
		R: &config.R{
			PackageFile: "renv.lock",
		},
	}

	rInterpreter, err := interpreters.NewRInterpreter(s.testProjectDir, util.Path{}, s.log, nil, nil, nil)
	s.Require().NoError(err)

	rExecutable, err := rInterpreter.GetRExecutable()
	s.T().Logf("R executable path: %s", rExecutable)
	// Don't require this to succeed as it might not be available in all test environments
	if err != nil {
		s.T().Logf("Could not get R executable: %v", err)
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

func (s *RPublishFunctionalSuite) TestPublishWithClientFunctional() {
	if s.skipIfNoR() {
		return
	}

	// 1. Set up test account
	account := &accounts.Account{
		ServerType: accounts.ServerTypeConnect,
		Name:       "test-account",
		URL:        "https://connect.example.com",
	}

	// 2. Set up a mock client
	client := connect.NewMockClient()

	// 3. Configure mock responses for each API call made by publishWithClient
	// Content creation
	contentID := types.ContentID("test-content-id")
	client.On("CreateDeployment", mock.Anything, mock.Anything).Return(contentID, nil)

	// Authentication
	client.On("TestAuthentication", mock.Anything).Return(&connect.User{
		Username: "test-user",
		Email:    "test@example.com",
	}, nil)

	// Capability checks
	client.On("CheckCapabilities", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	// Content updates
	client.On("UpdateDeployment", contentID, mock.Anything, mock.Anything).Return(nil)

	// Environment variables
	client.On("SetEnvVars", contentID, mock.Anything, mock.Anything).Return(nil)

	// Bundle upload
	bundleID := types.BundleID("test-bundle-id")
	client.On("UploadBundle", contentID, mock.Anything, mock.Anything).Return(bundleID, nil)

	// Deployment
	taskID := types.TaskID("test-task-id")
	client.On("DeployBundle", contentID, bundleID, mock.Anything).Return(taskID, nil)

	// Wait for task
	client.On("WaitForTask", taskID, mock.Anything, mock.Anything).Return(nil)

	// Validation
	client.On("ValidateDeployment", contentID, mock.Anything).Return(nil)

	// 4. Set up config for R Shiny app (instead of Python Dash)
	cfg := config.New()
	cfg.Schema = schema.ConfigSchemaURL
	cfg.Type = config.ContentTypeRShiny // Change to R Shiny type
	cfg.Entrypoint = "app.R"            // Use R entrypoint
	cfg.Title = "Test R Application"
	cfg.Environment = map[string]string{"TEST_VAR": "test-value"}
	cfg.Validate = true

	// Add required configuration items for R applications
	cfg.R = &config.R{
		Version:        "4.2", // Specify R version
		PackageManager: "renv",
		PackageFile:    "renv.lock",
	}

	// Include files required for R applications
	cfg.Files = []string{
		"app.R",
		"renv.lock",
	}

	// 5. Create state store
	stateStore := &state.State{
		Dir:        s.testProjectDir,
		Account:    account,
		Config:     cfg,
		ConfigName: "test-config",
		SaveName:   "test-deployment",
		TargetName: "test-deployment",
	}

	// 6. Create a real package mapper instance instead of a mock
	rPackageMapper, err := renv.NewPackageMapper(s.testProjectDir, util.Path{}, s.log)
	s.Require().NoError(err)

	// // ADD TEST FOR RENV STATUS: Get the R interpreter and test renv functionality
	// rInterpreter, err := interpreters.NewRInterpreter(s.testProjectDir, util.Path{}, s.log, nil, nil, nil)
	// s.Require().NoError(err)

	// // Get R executable
	// rExecutable, err := rInterpreter.GetRExecutable()
	// if err == nil && rExecutable.String() != "" {
	// 	// If we can get a valid R executable, check renv environment
	// 	// This will indirectly call renvStatus() internally
	// 	envErr := rInterpreter.RenvEnvironmentErrorCheck()
	// 	s.T().Logf("RenvEnvironmentErrorCheck result: %v", envErr)
	// }

	// 7. Create publisher instance with the real package mapper
	publisher := &defaultPublisher{
		State:          stateStore,
		log:            s.log,
		emitter:        events.NewCapturingEmitter(),
		rPackageMapper: rPackageMapper,
	}

	// 8. Create test files in the temp directory - R files instead of Python
	appRPath := s.testProjectDir.Join("app.R")
	err = appRPath.WriteFile([]byte(`
library(shiny)

ui <- fluidPage(
  titlePanel("Hello Shiny!")
)

server <- function(input, output) {
}

shinyApp(ui = ui, server = server)
`), 0644)
	s.Require().NoError(err)

	// Our renv.lock file was already created in SetupTest

	// 9. Call publishWithClient
	err = publisher.publishWithClient(account, client)
	s.Require().NoError(err)

	// 10. Verify the mock calls were made as expected
	client.AssertExpectations(s.T())

	// 11. Verify deployment record was created with correct information
	recordPath := deployment.GetDeploymentPath(stateStore.Dir, stateStore.TargetName)
	record, err := deployment.FromFile(recordPath)
	s.Require().NoError(err)

	s.Equal(contentID, record.ID)
	s.Equal(bundleID, record.BundleID)
	s.Equal("https://connect.example.com/connect/#/apps/test-content-id", record.DashboardURL)
	s.Equal("https://connect.example.com/content/test-content-id/", record.DirectURL)
	s.NotEmpty(record.DeployedAt)
}
