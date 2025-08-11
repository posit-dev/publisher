package credentials

import (
	"github.com/stretchr/testify/mock"
)

// MockCredentialsService is a mock implementation of the CredentialsService interface
type MockCredentialsService struct {
	mock.Mock
}

var _ CredentialsService = &MockCredentialsService{}

func (m *MockCredentialsService) List() ([]Credential, error) {
	args := m.Called()
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.([]Credential), args.Error(1)
}

func (m *MockCredentialsService) Get(id string) (*Credential, error) {
	args := m.Called(id)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*Credential), args.Error(1)
}

func (m *MockCredentialsService) Set(details CreateCredentialDetails) (*Credential, error) {
	args := m.Called(details)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*Credential), args.Error(1)
}

func (m *MockCredentialsService) ForceSet(details CreateCredentialDetails) (*Credential, error) {
	args := m.Called(details)
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*Credential), args.Error(1)
}

func (m *MockCredentialsService) Delete(id string) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockCredentialsService) GetDefaultCloudServer() (*Credential, error) {
	args := m.Called()
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*Credential), args.Error(1)
}

func (m *MockCredentialsService) GetDefaultServer() (*Credential, error) {
	args := m.Called()
	result := args.Get(0)
	if result == nil {
		return nil, args.Error(1)
	}
	return result.(*Credential), args.Error(1)
}

func (m *MockCredentialsService) SetDefaultServer(id string) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockCredentialsService) ClearDefaultServer() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockCredentialsService) Reset() (string, error) {
	args := m.Called()
	result := args.Get(0)
	if result == nil {
		return "", args.Error(1)
	}
	return result.(string), args.Error(1)
}
