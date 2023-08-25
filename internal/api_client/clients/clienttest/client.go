package clienttest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/rstudio/connect-client/internal/api_client/clients"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/stretchr/testify/mock"
)

type MockClient struct {
	mock.Mock
}

func NewMockClient() *MockClient {
	return new(MockClient)
}

var _ clients.APIClient = &MockClient{}

func (m *MockClient) Read(p []byte) (n int, err error) {
	args := m.Called(p)
	return args.Int(0), args.Error(1)
}

func (m *MockClient) TestConnection() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockClient) TestAuthentication() (*clients.User, error) {
	args := m.Called()
	return args.Get(0).(*clients.User), args.Error(1)
}

func (m *MockClient) CreateDeployment(s state.ConnectContent) (apitypes.ContentID, error) {
	args := m.Called(s)
	return args.Get(0).(apitypes.ContentID), args.Error(1)
}

func (m *MockClient) UpdateDeployment(id apitypes.ContentID, s state.ConnectContent) error {
	args := m.Called(id, s)
	return args.Error(0)
}

func (m *MockClient) UploadBundle(id apitypes.ContentID, r io.Reader) (apitypes.BundleID, error) {
	args := m.Called(id, r)
	return args.Get(0).(apitypes.BundleID), args.Error(1)
}

func (m *MockClient) DeployBundle(cid apitypes.ContentID, bid apitypes.BundleID) (apitypes.TaskID, error) {
	args := m.Called(cid, bid)
	return args.Get(0).(apitypes.TaskID), args.Error(1)
}

func (m *MockClient) WaitForTask(taskID apitypes.TaskID, log events.Logger) error {
	args := m.Called(taskID, log)
	return args.Error(0)
}
