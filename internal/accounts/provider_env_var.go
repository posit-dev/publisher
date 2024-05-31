package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type envVarProvider struct {
	log logging.Logger
}

func newEnvVarProvider(log logging.Logger) *envVarProvider {
	return &envVarProvider{
		log: log,
	}
}

func (p *envVarProvider) Load() ([]Account, error) {
	serverURL := os.Getenv("CONNECT_SERVER")
	if serverURL == "" {
		return nil, nil
	}
	serverURL, err := util.NormalizeServerURL(serverURL)
	if err != nil {
		return nil, err
	}
	apiKey := os.Getenv("CONNECT_API_KEY")
	if apiKey == "" {
		return nil, nil
	}
	account := Account{
		ServerType:  serverTypeFromURL(serverURL),
		Source:      AccountSourceEnvironment,
		Name:        "env",
		URL:         serverURL,
		Insecure:    (os.Getenv("CONNECT_INSECURE") != ""),
		Certificate: os.Getenv("CONNECT_CERT"),
		ApiKey:      apiKey,
	}
	account.AuthType = account.InferAuthType()
	p.log.Info("Creating account from CONNECT_SERVER", "name", account.Name, "url", serverURL)
	return []Account{account}, nil
}
