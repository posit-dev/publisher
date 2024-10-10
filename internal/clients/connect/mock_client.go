package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
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

func (m *MockClient) TestAuthentication(log logging.Logger) (*User, error) {
	args := m.Called(log)
	user := args.Get(0)
	if user == nil {
		return nil, args.Error(1)
	} else {
		return user.(*User), args.Error(1)
	}
}

func (m *MockClient) ContentDetails(id types.ContentID, s *ConnectContent, log logging.Logger) error {
	// Updates content as locked when needed
	if id == "myLockedContentID" {
		s.GUID = "myLockedContentID"
		s.Locked = true
	}
	args := m.Called(id, s, log)
	return args.Error(0)
}

func (m *MockClient) CreateDeployment(s *ConnectContent, log logging.Logger) (types.ContentID, error) {
	args := m.Called(s, log)
	return args.Get(0).(types.ContentID), args.Error(1)
}

func (m *MockClient) UpdateDeployment(id types.ContentID, s *ConnectContent, log logging.Logger) error {
	args := m.Called(id, s, log)
	return args.Error(0)
}

func (m *MockClient) SetEnvVars(id types.ContentID, env config.Environment, log logging.Logger) error {
	args := m.Called(id, env, log)
	return args.Error(0)
}

func (m *MockClient) UploadBundle(id types.ContentID, r io.Reader, log logging.Logger) (types.BundleID, error) {
	args := m.Called(id, r, log)
	return args.Get(0).(types.BundleID), args.Error(1)
}

func (m *MockClient) DeployBundle(cid types.ContentID, bid types.BundleID, log logging.Logger) (types.TaskID, error) {
	args := m.Called(cid, bid, log)
	return args.Get(0).(types.TaskID), args.Error(1)
}

func (m *MockClient) WaitForTask(taskID types.TaskID, log logging.Logger) error {
	args := m.Called(taskID, log)
	return args.Error(0)
}

func (m *MockClient) ValidateDeployment(id types.ContentID, log logging.Logger) error {
	args := m.Called(id, log)
	return args.Error(0)
}

func (m *MockClient) CheckCapabilities(base util.AbsolutePath, cfg *config.Config, log logging.Logger) error {
	args := m.Called(base, cfg, log)
	return args.Error(0)
}
