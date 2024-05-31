package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/spf13/afero"
)

type AccountProvider interface {
	Load() ([]Account, error)
}

type AccountList interface {
	GetAllAccounts() ([]Account, error)
	GetAccountByName(name string) (*Account, error)
	GetAccountsByServerType(_ ServerType) ([]Account, error)
	GetAccountByServerURL(url string) (*Account, error)
}

type defaultAccountList struct {
	providers []AccountProvider
	log       logging.Logger
}

var _ AccountList = &defaultAccountList{}

func NewAccountList(fs afero.Fs, log logging.Logger) *defaultAccountList {
	return &defaultAccountList{
		providers: []AccountProvider{
			NewCredentialsProvider(),
		},
		log: log,
	}
}

func (l *defaultAccountList) GetAllAccounts() (accounts []Account, err error) {
	for _, provider := range l.providers {
		providerAccounts, err := provider.Load()
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, providerAccounts...)

	}
	return accounts, nil
}

var ErrAccountNotFound = errors.New("no such account")

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
	return nil, fmt.Errorf("cannot get account named '%s': %w", name, ErrAccountNotFound)
}

func (l *defaultAccountList) GetAccountByServerURL(url string) (*Account, error) {
	accounts, err := l.GetAllAccounts()
	if err != nil {
		return nil, err
	}
	for _, account := range accounts {
		if account.URL == url {
			return &account, nil
		}
	}
	return nil, fmt.Errorf("there is no account for the server '%s'", url)
}

func (l *defaultAccountList) GetAccountsByServerType(serverType ServerType) (accounts []Account, err error) {
	all, err := l.GetAllAccounts()
	if err != nil {
		return nil, err
	}

	for _, account := range all {
		if account.ServerType == serverType {
			accounts = append(accounts, account)
		}
	}

	return accounts, nil
}
