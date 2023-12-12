package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/stretchr/testify/mock"
)

type MockClient struct {
	mock.Mock
}

func NewMockClient() *MockClient {
	return new(MockClient)
}

var _ APIClient = &MockClient{}

func (m *MockClient) Read(p []byte) (n int, err error) {
	args := m.Called(p)
	return args.Int(0), args.Error(1)
}

func (m *MockClient) TestAuthentication() (*User, error) {
	args := m.Called()
	return args.Get(0).(*User), args.Error(1)
}

func (m *MockClient) CreateDeployment(s *ConnectContent) (types.ContentID, error) {
	args := m.Called(s)
	return args.Get(0).(types.ContentID), args.Error(1)
}

func (m *MockClient) UpdateDeployment(id types.ContentID, s *ConnectContent) error {
	args := m.Called(id, s)
	return args.Error(0)
}

func (m *MockClient) SetEnvVars(id types.ContentID, env config.Environment) error {
	args := m.Called(id, env)
	return args.Error(0)
}

func (m *MockClient) UploadBundle(id types.ContentID, r io.Reader) (types.BundleID, error) {
	args := m.Called(id, r)
	return args.Get(0).(types.BundleID), args.Error(1)
}

func (m *MockClient) DeployBundle(cid types.ContentID, bid types.BundleID) (types.TaskID, error) {
	args := m.Called(cid, bid)
	return args.Get(0).(types.TaskID), args.Error(1)
}

func (m *MockClient) WaitForTask(taskID types.TaskID, log logging.Logger) error {
	args := m.Called(taskID, log)
	return args.Error(0)
}

func (m *MockClient) ValidateDeployment(id types.ContentID) error {
	args := m.Called(id)
	return args.Error(0)
}
