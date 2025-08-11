package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/stretchr/testify/mock"
)

// MockAPIClient is a mock implementation of the APIClient interface
type MockAPIClient struct {
	mock.Mock
}

func (m *MockAPIClient) GetCurrentUser() (*UserResponse, error) {
	args := m.Called()
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*UserResponse), args.Error(1)
}

func (m *MockAPIClient) GetAccounts() (*AccountListResponse, error) {
	args := m.Called()
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*AccountListResponse), args.Error(1)
}

func (m *MockAPIClient) CreateContent(request *clienttypes.CreateContentRequest) (*clienttypes.ContentResponse, error) {
	args := m.Called(request)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*clienttypes.ContentResponse), args.Error(1)
}

func (m *MockAPIClient) UpdateContent(request *clienttypes.UpdateContentRequest) (*clienttypes.ContentResponse, error) {
	args := m.Called(request)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*clienttypes.ContentResponse), args.Error(1)
}

func (m *MockAPIClient) UpdateContentBundle(contentID types.ContentID) (*clienttypes.ContentResponse, error) {
	args := m.Called(contentID)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*clienttypes.ContentResponse), args.Error(1)
}

func (m *MockAPIClient) GetAuthorization(request *clienttypes.AuthorizationRequest) (*clienttypes.AuthorizationResponse, error) {
	args := m.Called(request)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*clienttypes.AuthorizationResponse), args.Error(1)
}

func (m *MockAPIClient) GetRevision(revisionID string) (*clienttypes.Revision, error) {
	args := m.Called(revisionID)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*clienttypes.Revision), args.Error(1)
}

func (m *MockAPIClient) PublishContent(contentID string) error {
	args := m.Called(contentID)
	return args.Error(0)
}

// Create a mock for cloud_auth.APIClient
type MockCloudAuthClient struct {
	mock.Mock
}

func (m *MockCloudAuthClient) CreateDeviceAuth() (*cloud_auth.DeviceAuthResponse, error) {
	args := m.Called()
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*cloud_auth.DeviceAuthResponse), args.Error(1)
}

func (m *MockCloudAuthClient) ExchangeToken(request cloud_auth.TokenRequest) (*cloud_auth.TokenResponse, error) {
	args := m.Called(request)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*cloud_auth.TokenResponse), args.Error(1)
}