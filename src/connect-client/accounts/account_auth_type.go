package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountAuthType string

const (
	AccountAuthAPIKey AccountAuthType = "api-key" // Connect API key
	AccountAuthToken                  = "token"   // rsconnect token & private key
	AccountAuthNone                   = "none"    // No saved credentials
)

func (auth AccountAuthType) String() string {
	switch auth {
	case AccountAuthAPIKey:
		return "Connect API key"
	case AccountAuthToken:
		return "RStudio IDE/rsconnect token"
	case AccountAuthNone:
		return "No saved credentials"
	default:
		return string(auth)
	}
}
