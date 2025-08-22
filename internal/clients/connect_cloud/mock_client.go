package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/stretchr/testify/mock"

	"github.com/posit-dev/publisher/internal/clients/types"
	content_types "github.com/posit-dev/publisher/internal/types"
)

type MockClient struct {
	mock.Mock
}

func (m *MockClient) GetContent(contentID content_types.ContentID) (*types.ContentResponse, error) {
	args := m.Called(contentID)
	return args.Get(0).(*types.ContentResponse), args.Error(1)
}

func NewMockClient() *MockClient {
	return new(MockClient)
}

var _ APIClient = &MockClient{}

func (m *MockClient) GetCurrentUser() (*UserResponse, error) {
	args := m.Called()
	return args.Get(0).(*UserResponse), args.Error(1)
}

func (m *MockClient) GetAccounts() (*AccountListResponse, error) {
	args := m.Called()
	return args.Get(0).(*AccountListResponse), args.Error(1)
}

func (m *MockClient) CreateContent(request *types.CreateContentRequest) (*types.ContentResponse, error) {
	args := m.Called(request)
	return args.Get(0).(*types.ContentResponse), args.Error(1)
}

func (m *MockClient) UpdateContent(request *types.UpdateContentRequest) (*types.ContentResponse, error) {
	args := m.Called(request)
	return args.Get(0).(*types.ContentResponse), args.Error(1)
}

func (m *MockClient) GetAuthorization(request *types.AuthorizationRequest) (*types.AuthorizationResponse, error) {
	args := m.Called(request)
	return args.Get(0).(*types.AuthorizationResponse), args.Error(1)
}

func (m *MockClient) GetRevision(revisionID string) (*types.Revision, error) {
	args := m.Called(revisionID)
	return args.Get(0).(*types.Revision), args.Error(1)
}

func (m *MockClient) PublishContent(contentID string) error {
	args := m.Called(contentID)
	return args.Error(0)
}
