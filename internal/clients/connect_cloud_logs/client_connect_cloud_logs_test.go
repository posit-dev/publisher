package connect_cloud_logs

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/r3labs/sse/v2"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type ConnectCloudLogsClientSuite struct {
	utiltest.Suite
	mockLogger    *loggingtest.MockLogger
	mockLogLogger *loggingtest.MockLogger
}

func TestConnectCloudLogsClientSuite(t *testing.T) {
	s := new(ConnectCloudLogsClientSuite)
	suite.Run(t, s)
}

func (s *ConnectCloudLogsClientSuite) SetupTest() {
	s.mockLogger = loggingtest.NewMockLogger()
	s.mockLogLogger = loggingtest.NewMockLogger()
}

func (s *ConnectCloudLogsClientSuite) TestGetBaseURL() {
	// Test each environment
	s.Equal("https://logs.dev.connect.posit.cloud", getBaseURL(types.CloudEnvironmentDevelopment))
	s.Equal("https://logs.staging.connect.posit.cloud", getBaseURL(types.CloudEnvironmentStaging))
	s.Equal("https://logs.connect.posit.cloud", getBaseURL(types.CloudEnvironmentProduction))
}

func (s *ConnectCloudLogsClientSuite) TestNewConnectCloudLogsClient() {
	// Test client creation with proper parameters
	logChannel := "test-channel-123"
	accessToken := "test-token"

	// Create client
	client := NewConnectCloudLogsClient(
		types.CloudEnvironmentStaging,
		logChannel,
		accessToken,
		s.mockLogger,
	)

	// Check that we got the correct type
	_, ok := client.(*ConnectCloudLogsClient)
	s.True(ok, "Should return a ConnectCloudLogsClient")
}

// TestWatchLogsWithSSEServer tests the WatchLogs function using a proper SSE server from the r3labs/sse/v2 library
func (s *ConnectCloudLogsClientSuite) TestWatchLogsWithSSEServer() {
	// Create a new SSE server and stream
	server := sse.New()
	streamID := "streamy"
	stream := server.CreateStream(streamID)

	// Start an HTTP server to serve SSE events
	httpServer := httptest.NewServer(server)
	defer httpServer.Close()

	// Create a client that connects to our test server
	// The SSE server expects a stream parameter in the URL query
	sseClient := sse.NewClient(fmt.Sprintf("%s/?stream=%s", httpServer.URL, streamID))

	// Create a channel to signal when the log events have been processed
	processed := make(chan struct{})

	// Create a custom mockLogLogger that signals the processed channel when the last message is processed
	mockLogLogger := loggingtest.NewMockLogger()
	mockLogLogger.On("Info", "Test build info message").Once()
	mockLogLogger.On("Error", "Test build error message").Once()
	// For the last expected call, we'll signal the processed channel to indicate that all logs were processed
	mockLogLogger.On("Debug", "Test build debug message").Once().Run(func(args mock.Arguments) {
		// Signal that all messages have been processed
		close(processed)
	})

	// Create our logs client with the SSE client
	logsClient := &ConnectCloudLogsClient{
		log:    logging.New(),
		client: sseClient,
	}

	// Create context with cancellation for the test
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() // Ensure everything is cleaned up after the test

	// Start watching logs
	err := logsClient.WatchLogs(ctx, mockLogLogger)
	s.NoError(err, "WatchLogs should not return an error")

	// Now publish log events to the stream
	logData := []LogMessage{
		{
			Timestamp: time.Now().Unix(),
			SortKey:   1,
			Message:   "Test build info message",
			Type:      LogTypeBuild,
			Level:     LogLevelInfo,
		},
		{
			Timestamp: time.Now().Unix(),
			SortKey:   2,
			Message:   "Test build error message",
			Type:      LogTypeBuild,
			Level:     LogLevelError,
		},
		{
			Timestamp: time.Now().Unix(),
			SortKey:   3,
			Message:   "Test build debug message",
			Type:      LogTypeBuild,
			Level:     LogLevelDebug,
		},
		{
			Timestamp: time.Now().Unix(),
			SortKey:   4,
			Message:   "Test runtime message (should be ignored)",
			Type:      LogTypeRuntime,
			Level:     LogLevelInfo,
		},
	}

	// Create a LogsResponse and publish it
	logsResponse := LogsResponse{Data: logData}
	jsonData, _ := json.Marshal(logsResponse)

	// Publish the event to the stream
	server.Publish(stream.ID, &sse.Event{
		Data: jsonData,
	})

	// Wait for all log events to be processed or timeout after 2 seconds
	select {
	case <-processed:
		// All events processed successfully
	case <-time.After(2 * time.Second):
		s.Fail("Timed out waiting for log events to be processed")
	}

	// Verify expectations - all the debug/info/error method calls were made
	mockLogLogger.AssertExpectations(s.T())
}
