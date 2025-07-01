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

func (m *MockClient) CreateDeviceAuth(request DeviceAuthRequest) (*DeviceAuthResult, error) {
	args := m.Called(request)
	return args.Get(2).(*DeviceAuthResult), args.Error(1)
}
