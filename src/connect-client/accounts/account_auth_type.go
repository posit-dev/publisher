package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type ServerAuthType string

const (
	ServerAuthAPIKey ServerAuthType = "api-key" // Connect API key
	ServerAuthToken                 = "token"   // rsconnect token & private key
	ServerAuthNone                  = "none"    // No saved credentials
)

func (auth ServerAuthType) String() string {
	switch auth {
	case ServerAuthAPIKey:
		return "Connect API key"
	case ServerAuthToken:
		return "RStudio IDE/rsconnect token"
	case ServerAuthNone:
		return "No saved credentials"
	default:
		return string(auth)
	}
}
