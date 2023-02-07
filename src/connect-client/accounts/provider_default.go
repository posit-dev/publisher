package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import "os"

type defaultProvider struct{}

func newDefaultProvider() provider {
	return &defaultProvider{}
}

func (p *defaultProvider) Load() ([]Account, error) {
	serverURL := os.Getenv("CONNECT_SERVER")
	if serverURL == "" {
		return nil, nil
	}
	account := Account{
		Type:        accountTypeFromURL(serverURL),
		Source:      AccountSourceEnvironment,
		Name:        "default",
		URL:         serverURL,
		Insecure:    (os.Getenv("CONNECT_INSECURE") != ""),
		Certificate: os.Getenv("CONNECT_CERT"),
		ApiKey:      os.Getenv("CONNECT_API_KEY"),
	}
	if account.ApiKey != "" {
		account.AuthType = AccountAuthAPIKey
	} else {
		account.AuthType = AccountAuthNone
	}
	return []Account{account}, nil
}
