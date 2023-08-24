package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"os"
)

type envVarProvider struct {
	logger *slog.Logger
}

func newEnvVarProvider(logger *slog.Logger) *envVarProvider {
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
	p.logger.Info("Creating account from CONNECT_SERVER", "name", account.Name, "url", serverURL)
	return []Account{account}, nil
}
