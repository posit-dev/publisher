package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

// ServerPublisherSuite is a test suite for testing server_publisher.go
type ServerPublisherSuite struct {
	utiltest.Suite
	publisher *ServerPublisher
}

func TestServerPublisherSuite(t *testing.T) {
	suite.Run(t, new(ServerPublisherSuite))
}

func (s *ServerPublisherSuite) SetupTest() {
	// Create a minimal publisher for testing
	s.publisher = &ServerPublisher{
		log: logging.New(),

		helper: &publishhelper.PublishHelper{
			State: &state.State{
				Account: &accounts.Account{},
			},
		},
	}
}

func (s *ServerPublisherSuite) TestGetContentInfo() {
	// Define test cases for each environment
	testCases := []struct {
		name           string
		environment    types.CloudEnvironment
		contentID      types.ContentID
		accountName    string
		expectedUI     string
		expectedDirect string
	}{
		{
			name:           "Production",
			environment:    types.CloudEnvironmentProduction,
			contentID:      "abc123",
			accountName:    "test-account",
			expectedUI:     "https://connect.posit.cloud",
			expectedDirect: "https://abc123.share.connect.posit.cloud",
		},
		{
			name:           "Staging",
			environment:    types.CloudEnvironmentStaging,
			contentID:      "abc123",
			accountName:    "test-account",
			expectedUI:     "https://staging.connect.posit.cloud",
			expectedDirect: "https://abc123.share.staging.connect.posit.cloud",
		},
		{
			name:           "Development",
			environment:    types.CloudEnvironmentDevelopment,
			contentID:      "abc123",
			accountName:    "test-account",
			expectedUI:     "https://dev.connect.posit.cloud",
			expectedDirect: "https://abc123.share.dev.connect.posit.cloud",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			// Set up the environment for this test case
			s.publisher.helper.Account.CloudEnvironment = tc.environment
			s.publisher.helper.Account.CloudAccountName = tc.accountName

			// Call GetContentInfo
			info := s.publisher.GetContentInfo(tc.contentID)

			// Verify ContentID is preserved
			s.Equal(tc.contentID, info.ContentID)

			// Verify expected URLs
			expectedDashboard := fmt.Sprintf("%s/%s/content/%s", tc.expectedUI, tc.accountName, tc.contentID)
			s.Equal(expectedDashboard, info.DashboardURL, "Dashboard URL should match expected pattern")

			s.Equal(tc.expectedDirect, info.DirectURL, "Direct URL should match expected pattern")

			expectedLogs := fmt.Sprintf("%s/history", expectedDashboard)
			s.Equal(expectedLogs, info.LogsURL, "Logs URL should be dashboard URL plus /history")
		})
	}
}

func (s *ServerPublisherSuite) TestUpdateState() {
	// Create a config with Python and R settings
	cfg := &config.Config{
		Python: &config.Python{
			Version:               "3.10.4",
			PackageManager:        "pip",
			PackageFile:           "requirements.txt",
			RequiresPythonVersion: ">=3.9",
		},
		R: &config.R{
			Version:          "4.2.1",
			PackageManager:   "renv",
			PackageFile:      "renv.lock",
			RequiresRVersion: ">=4.0",
		},
	}

	// Set up a state with the config and target
	target := &deployment.Deployment{}
	s.publisher.State = &state.State{
		Config: cfg,
		Target: target,
		Account: &accounts.Account{
			CloudAccountName: "test-account",
		},
	}

	// Call UpdateState
	s.publisher.UpdateState()

	// Verify ConnectCloud field is set in target
	s.Require().NotNil(target.ConnectCloud)
	s.Equal("test-account", target.ConnectCloud.AccountName)

	// Verify Python configuration changes
	s.Require().NotNil(cfg.Python)
	s.Equal("", cfg.Python.PackageManager, "should be unset")
	s.Equal("", cfg.Python.PackageFile, "should be unset")
	s.Equal("", cfg.Python.RequiresPythonVersion, "should be unset")
	s.Equal("3.10", cfg.Python.Version, "should be converted to X.Y format")

	// Verify R configuration changes
	s.Require().NotNil(cfg.R)
	s.Equal("", cfg.R.PackageManager, "should be unset")
	s.Equal("", cfg.R.PackageFile, "should be unset")
	s.Equal("", cfg.R.RequiresRVersion, "should be unset")
	s.Equal("4.2.1", cfg.R.Version, "should remain unchanged")
}
