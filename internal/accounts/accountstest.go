package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/stretchr/testify/mock"
)

type MockAccountList struct {
	mock.Mock
	AccountList
}

func NewMockAccountList() *MockAccountList {
	return &MockAccountList{}
}

func (m *MockAccountList) GetAllAccounts() ([]Account, error) {
	args := m.Called()
	return args.Get(0).([]Account), args.Error(1)
}

func (m *MockAccountList) GetAccountByName(name string) (*Account, error) {
	args := m.Called(name)
	return args.Get(0).(*Account), args.Error(1)
}

func (m *MockAccountList) GetAccountsByServerType(serverType ServerType) ([]Account, error) {
	args := m.Called(serverType)
	return args.Get(0).([]Account), args.Error(1)
}

type MockAccountProvider struct {
	mock.Mock
}

func (m *MockAccountProvider) Load() ([]Account, error) {
	args := m.Called()
	accounts := args.Get(0)
	if accounts == nil {
		return nil, args.Error(1)
	} else {
		return accounts.([]Account), args.Error(1)
	}
}
