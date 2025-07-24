package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/stretchr/testify/mock"
)

type MockClient struct {
	mock.Mock
}

func NewMockClient() *MockClient {
	return new(MockClient)
}

var _ APIClient = &MockClient{}

func (m *MockClient) GetCurrentUser() (*UserResponse, error) {
	args := m.Called()
	return args.Get(0).(*UserResponse), args.Error(1)
}

func (m *MockClient) CreateUser() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockClient) GetAccounts() (*AccountListResponse, error) {
	args := m.Called()
	return args.Get(0).(*AccountListResponse), args.Error(1)
}
