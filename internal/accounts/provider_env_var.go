package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/rstudio/publishing-client/internal/logging"
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
	p.log.Info("Creating account from CONNECT_SERVER", "name", account.Name, "url", serverURL)
	return []Account{account}, nil
}
