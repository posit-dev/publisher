package connect_cloud_upload

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"io"

	"github.com/stretchr/testify/mock"
)

// MockUploadClient is a mock implementation of the UploadAPIClient interface for testing
type MockUploadClient struct {
	mock.Mock
}

// NewMockUploadClient creates a new mock client for testing
func NewMockUploadClient() *MockUploadClient {
	return new(MockUploadClient)
}

var _ UploadAPIClient = &MockUploadClient{}

// UploadBundle mocks the UploadBundle method
func (m *MockUploadClient) UploadBundle(bundleContent io.Reader) error {
	args := m.Called(bundleContent)
	return args.Error(0)
}
