package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud_logs"
	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	internaltypes "github.com/posit-dev/publisher/internal/types"
)

// MockLogsAPIClient is a mock implementation of connect_cloud_logs.LogsAPIClient
type MockLogsAPIClient struct {
	mock.Mock
}

func (m *MockLogsAPIClient) WatchLogs(ctx context.Context, logLogger logging.Logger) error {
	args := m.Called(ctx, logLogger)
	return args.Error(0)
}

// LogsSuite is a test suite for testing logs.go
type LogsSuite struct {
	suite.Suite
	publisher  *ServerPublisher
	client     *connect_cloud.MockClient
	logsClient *MockLogsAPIClient
}

func TestLogsSuite(t *testing.T) {
	suite.Run(t, new(LogsSuite))
}

func (s *LogsSuite) SetupTest() {
	// Save the original factory function to restore it later

	// Create mock client
	s.client = connect_cloud.NewMockClient()

	// Create mock logs client
	s.logsClient = new(MockLogsAPIClient)

	// Replace the factory function with one that returns our mock
	logsClientFactory = func(environment internaltypes.CloudEnvironment, logChannel string, accessToken string, log logging.Logger) connect_cloud_logs.LogsAPIClient {
		return s.logsClient
	}

	// Create a publisher for testing with our mock client
	state := &state.State{
		Account: &accounts.Account{
			CloudEnvironment: internaltypes.CloudEnvironmentProduction,
		},
	}
	s.publisher = &ServerPublisher{
		State:  state,
		log:    logging.New(),
		client: s.client,
		helper: &publishhelper.PublishHelper{State: state},
		content: &types.ContentResponse{
			NextRevision: &types.Revision{
				PublishLogChannel: "test-log-channel",
			},
		},
	}
}

func (s *LogsSuite) TearDownTest() {
	logsClientFactory = connect_cloud_logs.NewConnectCloudLogsClient
}

func (s *LogsSuite) TestWatchLogs() {
	// Set up the mock client to return a successful authorization
	s.client.On("GetAuthorization", mock.MatchedBy(func(req *types.AuthorizationRequest) bool {
		return req.ResourceType == "log_channel" &&
			req.ResourceID == "test-log-channel" &&
			req.Permission == "revision.logs:read"
	})).Return(&types.AuthorizationResponse{
		Authorized: true,
		Token:      "test-token",
	}, nil)

	// Set up the mock logs client to return no error
	s.logsClient.On("WatchLogs", mock.Anything, mock.Anything).Return(nil)

	// Call watchLogs
	ctx := context.Background()
	err := s.publisher.watchLogs(ctx)
	s.NoError(err)

	// Verify expectations
	s.client.AssertExpectations(s.T())
	s.logsClient.AssertExpectations(s.T())
}
