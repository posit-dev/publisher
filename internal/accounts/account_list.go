package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type AccountProvider interface {
	Load() ([]Account, error)
}

type AccountList interface {
	GetAllAccounts() ([]Account, error)
	GetAccountByName(name string) (*Account, error)
}

type defaultAccountList struct {
	providers []AccountProvider
	logger    rslog.Logger
}

var _ AccountList = &defaultAccountList{}

func NewAccountList(fs afero.Fs, logger rslog.Logger) *defaultAccountList {
	return &defaultAccountList{
		providers: []AccountProvider{
			newEnvVarProvider(logger),
			newRSConnectProvider(fs, logger),
			newRSConnectPythonProvider(fs, logger),
		},
		logger: logger,
	}
}

func (l *defaultAccountList) GetAllAccounts() ([]Account, error) {
	accounts := []Account{}
	for _, provider := range l.providers {
		providerAccounts, err := provider.Load()
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, providerAccounts...)
	}
	return accounts, nil
}

func (l *defaultAccountList) GetAccountByName(name string) (*Account, error) {
	accounts, err := l.GetAllAccounts()
	if err != nil {
		return nil, err
	}
	for _, account := range accounts {
		if account.Name == name {
			return &account, nil
		}
	}
	return nil, fmt.Errorf("There is no account named '%s'", name)
}
