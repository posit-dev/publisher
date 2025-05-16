package credentialstest

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"github.com/stretchr/testify/mock"

	"github.com/posit-dev/publisher/internal/credentials"
)

type CredentialsServiceMock struct {
	mock.Mock
}

func NewCredentialsServiceMock() *CredentialsServiceMock {
	return &CredentialsServiceMock{}
}

func (m *CredentialsServiceMock) Delete(guid string) error {
	args := m.Called(guid)
	return args.Error(0)
}

func (m *CredentialsServiceMock) Get(guid string) (*credentials.Credential, error) {
	args := m.Called(guid)
	return args.Get(0).(*credentials.Credential), args.Error(1)
}

func (m *CredentialsServiceMock) List() ([]credentials.Credential, error) {
	args := m.Called()
	return args.Get(0).([]credentials.Credential), args.Error(1)
}

func (m *CredentialsServiceMock) Set(name string, url string, ak string, sf string) (*credentials.Credential, error) {
	args := m.Called(name, url, ak, sf)
	return args.Get(0).(*credentials.Credential), args.Error(1)
}

func (m *CredentialsServiceMock) Reset() (string, error) {
	args := m.Called()
	return args.Get(0).(string), args.Error(1)
}
