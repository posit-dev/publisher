package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/server_type"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type RPublishFunctionalSuite struct {
	suite.Suite
	testProjectDir util.AbsolutePath
	log            logging.Logger
	stateStore     *state.State
	emitter        events.Emitter
}

func TestRPublishFunctionalSuite(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	suite.Run(t, new(RPublishFunctionalSuite))
}

func (s *RPublishFunctionalSuite) SetupTest() {
	// Set up the test directory
	parentDir, err := os.MkdirTemp("", "r-packages-test-*")
	s.Require().NoError(err)

	// Create a subdirectory with spaces in the name
	dirWithSpaces := filepath.Join(parentDir, "WithSpaces")
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
}

func (s *RPublishFunctionalSuite) TearDownTest() {
	parentDir := filepath.Dir(s.testProjectDir.String())
	os.RemoveAll(parentDir)
	connectClientFactory = connect.NewConnectClient
}

func (s *RPublishFunctionalSuite) createTestRenvLock() {
	// Initialize R interpreter and check for R executable and renv availability
	rInterpreter, err := interpreters.NewRInterpreter(s.testProjectDir, util.Path{}, s.log, nil, nil, nil)
	s.Require().NoError(err)

	// use R to create a legit renv.lock file
	rExecutable, err := rInterpreter.GetRExecutable()
	s.Require().NoError(err)

	exec := executor.NewExecutor()
	_, _, err = exec.RunScript(rExecutable.String(), []string{"-s"}, "renv::init()", s.testProjectDir, s.log)
	s.Require().NoError(err)
}

func (s *RPublishFunctionalSuite) TestGetRPackagesFunctional() {
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

	// Test both lockfileOnly approaches
	testCases := []struct {
		name         string
		lockfileOnly bool
		description  string
	}{
		{
			name:         "R Environment Approach",
			lockfileOnly: false,
			description:  "Uses R environment and installed packages (defaultPackageMapper)",
		},
		{
			name:         "Lockfile Only Approach",
			lockfileOnly: true,
			description:  "Uses only renv.lock without R environment (LockfilePackageMapper)",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			s.T().Logf("Testing %s: %s", tc.name, tc.description)

			mapper, err := renv.NewPackageMapper(s.testProjectDir, util.Path{}, s.log, tc.lockfileOnly)
			s.Require().NoError(err)

			publisher := &defaultPublisher{
				log:            s.log,
				emitter:        s.emitter,
				rPackageMapper: mapper,
				PublishHelper:  publishhelper.NewPublishHelper(s.stateStore, s.log),
			}

			// Actually call getRPackages
			packageMap, err := publisher.getRPackages(false)

			// Both approaches should have a valid package map which includes renv
			s.Require().Nil(err)
			s.Require().Contains(packageMap, "renv")
			s.T().Logf("Successfully found %d packages using %s", len(packageMap), tc.name)
		})
	}
}

func (s *RPublishFunctionalSuite) TestPublishWithClientFunctional() {
	// Set up a mock client
	client := connect.NewMockClient()
	connectClientFactory = func(
		account *accounts.Account,
		timeout time.Duration,
		emitter events.Emitter,
		log logging.Logger) (connect.APIClient, error) {
		return client, nil
	}

	// Set up test account
	account := &accounts.Account{
		ServerType: server_type.ServerTypeConnect,
		Name:       "test-account",
		URL:        "https://connect.example.com",
	}
	client.On("TestAuthentication", mock.Anything).Return(&connect.User{
		Username: "test-user",
		Email:    "test@example.com",
	}, nil)

	// Mock responses
	contentID := types.ContentID("test-content-id")
	client.On("CreateDeployment", mock.Anything, mock.Anything).Return(contentID, nil)
	client.On("CheckCapabilities", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
	client.On("UpdateDeployment", contentID, mock.Anything, mock.Anything).Return(nil)
	client.On("SetEnvVars", contentID, mock.Anything, mock.Anything).Return(nil)
	bundleID := types.BundleID("test-bundle-id")
	client.On("UploadBundle", contentID, mock.Anything, mock.Anything).Return(bundleID, nil)
	taskID := types.TaskID("test-task-id")
	client.On("DeployBundle", contentID, bundleID, mock.Anything).Return(taskID, nil)
	client.On("WaitForTask", taskID, mock.Anything, mock.Anything).Return(nil)
	client.On("ValidateDeployment", contentID, mock.Anything).Return(nil)

	// Config for R Shiny app (instead of Python Dash)
	cfg := config.New()
	cfg.Schema = schema.ConfigSchemaURL
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = contenttypes.ContentTypeRShiny
	cfg.Entrypoint = "app.R"
	cfg.Title = "Test R Application"
	cfg.Environment = map[string]string{"TEST_VAR": "test-value"}
	validate := true
	cfg.Validate = &validate

	cfg.R = &config.R{
		PackageManager: "renv",
		PackageFile:    "renv.lock",
	}

	cfg.Files = []string{
		"app.R",
		"renv.lock",
	}

	stateStore := &state.State{
		Dir:        s.testProjectDir,
		Account:    account,
		Config:     cfg,
		ConfigName: "test-config",
		SaveName:   "test-deployment",
		TargetName: "test-deployment",
	}

	// Test both package mapper approaches in this integration test
	testCases := []struct {
		name         string
		lockfileOnly bool
	}{
		{"R Environment Integration", false},
		{"Lockfile Only Integration", true},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			s.T().Logf("Testing integration with %s", tc.name)

			// Create mapper for this test case
			packageMapper, mapperErr := renv.NewPackageMapper(s.testProjectDir, util.Path{}, s.log, tc.lockfileOnly)
			s.Require().NoError(mapperErr)

			serverPublisher, err := createServerPublisher(
				publishhelper.NewPublishHelper(stateStore, s.log),
				events.NewCapturingEmitter(),
				s.log)
			s.NoError(err)
			publisher := &defaultPublisher{
				log:             s.log,
				emitter:         events.NewCapturingEmitter(),
				rPackageMapper:  packageMapper,
				PublishHelper:   publishhelper.NewPublishHelper(stateStore, s.log),
				serverPublisher: serverPublisher,
			}

			// Test files to be deployed
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

			// The actual test call
			err = publisher.PublishDirectory()
			s.Require().NoError(err)

			// Verify the mock calls were made as expected
			client.AssertExpectations(s.T())

			// Verify deployment record was created with correct information
			recordPath := deployment.GetDeploymentPath(stateStore.Dir, stateStore.TargetName)
			record, err := deployment.FromFile(recordPath)
			s.Require().NoError(err)

			s.Equal(contentID, record.ID)
			s.Equal(bundleID, record.BundleID)
			s.Equal("https://connect.example.com/connect/#/apps/test-content-id", record.DashboardURL)
			s.Equal("https://connect.example.com/content/test-content-id/", record.DirectURL)
			s.NotEmpty(record.DeployedAt)

			s.T().Logf("Successfully completed integration test with %s", tc.name)
		})
	}
}
