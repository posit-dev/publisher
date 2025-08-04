// Copyright (C) 2024 by Posit Software, PBC.

package accounts

import (
	"errors"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
)

type CredentialsProvider struct {
	cs credentials.CredentialsService
}

// We can ignore errors related to malformed data on the initial loader
// API consumers handle resetting malformed data when needed.
func errIsNotLoadError(err error) bool {
	return err != nil && !errors.Is(err, &credentials.LoadError{}) && !errors.Is(err, &credentials.CorruptedError{})
}

func NewCredentialsProvider(log logging.Logger) (*CredentialsProvider, error) {
	cs, err := credentials.NewCredentialsService(log)
	if errIsNotLoadError(err) {
		return nil, err
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
			Source:                  AccountSourceKeychain,
			ServerType:              cred.ServerType,
			Name:                    cred.Name,
			URL:                     cred.URL,
			ApiKey:                  cred.ApiKey,
			SnowflakeConnection:     cred.SnowflakeConnection,
			ConnectCloudAccountName: cred.AccountName,
		}
		i++
	}

	return accounts, nil
}
