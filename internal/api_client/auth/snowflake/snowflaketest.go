package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/stretchr/testify/mock"
)

type MockConnections struct {
	mock.Mock
}

var _ Connections = &MockConnections{}

func (m *MockConnections) Get(name string) (*Connection, error) {
	args := m.Called(name)
	return args.Get(0).(*Connection), args.Error(1)
}

func (m *MockConnections) List() (map[string]*Connection, error) {
	args := m.Called()
	return args.Get(0).(map[string]*Connection), args.Error(1)
}
