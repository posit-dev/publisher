package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import "os"

type defaultProvider struct{}

func newDefaultProvider() provider {
	return &defaultProvider{}
}

func (p *defaultProvider) Load() ([]Server, error) {
	serverURL := os.Getenv("CONNECT_SERVER")
	if serverURL == "" {
		return nil, nil
	}
	server := Server{
		Type:        serverTypeFromURL(serverURL),
		Source:      ServerSourceEnvironment,
		Name:        "default",
		URL:         serverURL,
		Insecure:    (os.Getenv("CONNECT_INSECURE") != ""),
		Certificate: os.Getenv("CONNECT_CERT"),
		ApiKey:      os.Getenv("CONNECT_API_KEY"),
	}
	if server.ApiKey != "" {
		server.AuthType = ServerAuthAPIKey
	} else {
		server.AuthType = ServerAuthNone
	}
	return []Server{server}, nil
}
