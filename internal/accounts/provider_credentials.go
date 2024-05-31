// Copyright (C) 2024 by Posit Software, PBC.

package accounts

import "github.com/posit-dev/publisher/internal/credentials"

type CredentialsProvider struct {
	cs credentials.CredentialsService
}

func NewCredentialsProvider() *CredentialsProvider {
	return &CredentialsProvider{cs: credentials.CredentialsService{}}
}

func (p *CredentialsProvider) Load() ([]Account, error) {
	creds, err := p.cs.List()
	if err != nil {
		return nil, err
	}

	accounts := make([]Account, len(creds))
	i := 0
	for _, cred := range creds {
		accounts[i] = Account{
			Source:     AccountSourceKeychain,
			ServerType: serverTypeFromURL(cred.URL),
			Name:       cred.Name,
			URL:        cred.URL,
			AuthType:   AuthTypeAPIKey,
			ApiKey:     cred.ApiKey,
		}
		i++
	}

	return accounts, nil
}
