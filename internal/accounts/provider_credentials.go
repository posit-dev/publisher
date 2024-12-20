// Copyright (C) 2024 by Posit Software, PBC.

package accounts

import (
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type CredentialsProvider struct {
	cs credentials.CredentialsService
}

func NewCredentialsProvider(log logging.Logger) (*CredentialsProvider, error) {
	cs, err := credentials.NewCredentialsService(log)
	if err != nil {
		// Ignore errors from credentials reset at this point
		_, isCredsReset := types.IsAgentErrorOf(err, types.ErrorCredentialCorruptedReset)
		if !isCredsReset {
			return nil, err
		}
	}

	return &CredentialsProvider{cs}, nil
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
