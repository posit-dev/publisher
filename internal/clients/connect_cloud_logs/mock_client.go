package connect_cloud_logs

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/posit-dev/publisher/internal/logging"
)

// MockLogsClient is a mock implementation of the LogsAPIClient interface for testing
type MockLogsClient struct {
	mock.Mock
}

// NewMockLogsClient creates a new mock client for testing
func NewMockLogsClient() *MockLogsClient {
	return new(MockLogsClient)
}

var _ LogsAPIClient = &MockLogsClient{}

// WatchLogs mocks the WatchLogs method
func (m *MockLogsClient) WatchLogs(ctx context.Context, logLogger logging.Logger) error {
	args := m.Called(ctx, logLogger)
	return args.Error(0)
}
