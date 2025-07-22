package cloud_auth

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

func (m *MockClient) CreateDeviceAuth() (*DeviceAuthResponse, error) {
	args := m.Called()
	return args.Get(0).(*DeviceAuthResponse), args.Error(1)
}

func (m *MockClient) ExchangeToken(request TokenRequest) (*TokenResponse, error) {
	args := m.Called(request)
	tokenResponse := args.Get(0)
	if tokenResponse == nil {
		return nil, args.Error(1)
	}
	return tokenResponse.(*TokenResponse), nil
}
