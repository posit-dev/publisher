package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type envVarProvider struct {
	logger rslog.Logger
}

func newEnvVarProvider(logger rslog.Logger) *envVarProvider {
	return &envVarProvider{
		logger: logger,
	}
}

func (p *envVarProvider) Load() ([]Account, error) {
	serverURL := os.Getenv("CONNECT_SERVER")
	if serverURL == "" {
		return nil, nil
	}
	account := Account{
		ServerType:  serverTypeFromURL(serverURL),
		Source:      AccountSourceEnvironment,
		Name:        "env",
		URL:         serverURL,
		Insecure:    (os.Getenv("CONNECT_INSECURE") != ""),
		Certificate: os.Getenv("CONNECT_CERT"),
		ApiKey:      os.Getenv("CONNECT_API_KEY"),
	}
	account.AuthType = account.InferAuthType()
	p.logger.Infof("Creating '%s' account from CONNECT_SERVER: %s", account.Name, serverURL)
	return []Account{account}, nil
}
