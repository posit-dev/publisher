package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type defaultProvider struct {
	logger rslog.Logger
}

func newDefaultProvider(logger rslog.Logger) provider {
	return &defaultProvider{
		logger: logger,
	}
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
	account.AuthType = account.InferAuthType()
	p.logger.Infof("Creating default account from CONNECT_SERVER: %s", serverURL)
	return []Account{account}, nil
}
