package connect_cloud_logs

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type ConnectCloudLogsClientSuite struct {
	utiltest.Suite
}

func TestConnectCloudLogsClientSuite(t *testing.T) {
	s := new(ConnectCloudLogsClientSuite)
	suite.Run(t, s)
}

func (s *ConnectCloudLogsClientSuite) TestNewConnectCloudLogsClient() {
	timeout := 10 * time.Second
	log := logging.New()

	apiClient := NewConnectCloudLogsClientWithAuth("https://api.staging.login.posit.cloud", log, timeout, "Bearer the_token")
	client := apiClient.(*ConnectCloudLogsClient)
	s.NotNil(client.client)
}

func (s *ConnectCloudLogsClientSuite) TestGetLogs() {
	httpClient := &http_client.MockHTTPClient{}

	logChannelID := "publish-log-channel-123"
	expectedResponse := &LogsResponse{
		Data: []LogMessage{
			{
				Timestamp: 1625123456789,
				SortKey:   1,
				Message:   "Starting build process",
				Type:      LogTypeBuild,
				Level:     "info",
			},
			{
				Timestamp: 1625123456790,
				SortKey:   2,
				Message:   "Build completed successfully",
				Type:      LogTypeBuild,
				Level:     "info",
			},
			{
				Timestamp: 1625123456791,
				SortKey:   3,
				Message:   "Application started",
				Type:      LogTypeRuntime,
				Level:     "info",
			},
		},
	}

	httpClient.On("Get", "/v1/logs/"+logChannelID, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(1).(*LogsResponse)
		*result = *expectedResponse
	}

	client := &ConnectCloudLogsClient{
		client: httpClient,
		log:    logging.New(),
	}

	response, err := client.GetLogs(logChannelID)
	s.NoError(err)
	s.Equal(expectedResponse, response)
	s.Equal(3, len(response.Data))
	s.Equal("Starting build process", response.Data[0].Message)
	s.Equal(LogTypeBuild, response.Data[0].Type)
	s.Equal(LogTypeRuntime, response.Data[2].Type)
}
