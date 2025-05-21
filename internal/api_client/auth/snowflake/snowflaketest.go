package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"crypto/rsa"
	"time"

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

type MockAccess struct {
	mock.Mock
}

var _ Access = &MockAccess{}

func (m *MockAccess) GetSignedJWT(privateKey *rsa.PrivateKey, account string, user string, expiration time.Time) (string, error) {
	args := m.Called(privateKey, account, user, expiration)
	return args.String(0), args.Error(1)
}
func (m *MockAccess) GetAccessToken(account string, ingressURL string, signedToken string, role string) (string, error) {
	args := m.Called(account, ingressURL, signedToken, role)
	return args.String(0), args.Error(1)
}
