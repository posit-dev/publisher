package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type Account struct {
	Type        AccountType     // Which type of API this server provides
	Source      AccountSource   // Source of the saved server configuration
	AuthType    AccountAuthType // Authentication method (API key, token, etc)
	Name        string          // Nickname
	URL         string          // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool            // Skip https server verification
	Certificate string          `json:"ca_cert"`      // Root CA certificate, if server cert is signed by a private CA
	ApiKey      string          `json:"api_key"`      // For Connect servers
	AccountName string          `json:"account_name"` // For shinyapps.io and Posit Cloud servers
	Token       string          //   ...
	Secret      string          //   ...
}

type provider interface {
	Load() ([]Account, error)
}

type AccountList struct {
	accounts  []Account
	providers []provider
}

func NewAccountList() *AccountList {
	return &AccountList{
		accounts: []Account{},
		providers: []provider{
			newDefaultProvider(),
			newRSConnectProvider(),
			newRSConnectPythonProvider(),
		},
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
