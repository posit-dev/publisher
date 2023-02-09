package accounts

import "github.com/rstudio/platform-lib/pkg/rslog"

// Copyright (C) 2023 by Posit Software, PBC.

type Account struct {
	Type        AccountType     `json:"type"`         // Which type of API this server provides
	Source      AccountSource   `json:"source"`       // Source of the saved server configuration
	AuthType    AccountAuthType `json:"auth_type"`    // Authentication method (API key, token, etc)
	Name        string          `json:"name"`         // Nickname
	URL         string          `json:"url"`          // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool            `json:"insecure"`     // Skip https server verification
	Certificate string          `json:"-"`            // Root CA certificate, if server cert is signed by a private CA
	AccountName string          `json:"account_name"` // Username, if known
	ApiKey      string          `json:"-"`            // For Connect servers
	Token       string          `json:"-"`            // If IDE token auth is being used (requires secret or private key)
	Secret      string          `json:"-"`            // token auth for Connect
	PrivateKey  string          `json:"-"`            // token auth for shinyapps.io and Posit Cloud
}

func (acct *Account) InferAuthType() AccountAuthType {
	if acct.ApiKey != "" {
		return AuthTypeAPIKey
	} else if acct.Token != "" && acct.Secret != "" {
		return AuthTypeTokenSecret
	} else if acct.Token != "" && acct.PrivateKey != "" {
		return AuthTypeTokenKey
	}
	return AuthTypeNone
}

type provider interface {
	Load() ([]Account, error)
}

type AccountList struct {
	accounts  []Account
	providers []provider
	logger    rslog.Logger
}

func NewAccountList(logger rslog.Logger) *AccountList {
	return &AccountList{
		accounts: []Account{},
		providers: []provider{
			newDefaultProvider(logger),
			newRSConnectProvider(logger),
			newRSConnectPythonProvider(logger),
		},
		logger: logger,
	}
}

func (l *AccountList) Load() error {
	l.accounts = []Account{}
	for _, provider := range l.providers {
		accounts, err := provider.Load()
		if err != nil {
			return err
		}
		l.accounts = append(l.accounts, accounts...)
	}
	return nil
}

func (l *AccountList) GetAllAccounts() []Account {
	return l.accounts
}

func (l *AccountList) GetAccountByName(name string) (bool, Account) {
	for _, account := range l.accounts {
		if account.Name == name {
			return true, account
		}
	}
	return false, Account{}
}

func (l *AccountList) GetAccountByURL(url string) (bool, Account) {
	for _, account := range l.accounts {
		if account.URL == url {
			return true, account
		}
	}
	return false, Account{}
}
