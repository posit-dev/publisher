package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountAuthType string

const (
	AuthTypeAPIKey      AccountAuthType = "api-key"      // Connect API key
	AuthTypeTokenKey                    = "token-key"    // rsconnect token & private key (Connect)
	AuthTypeTokenSecret                 = "token-secret" // rsconnect token & secret (Cloud, shinyapps.io)
	AuthTypeNone                        = "none"         // No saved credentials
)

func (auth AccountAuthType) Description() string {
	switch auth {
	case AuthTypeAPIKey:
		return "Connect API key"
	case AuthTypeTokenKey:
		return "RStudio IDE/rsconnect token+key"
	case AuthTypeTokenSecret:
		return "RStudio IDE/rsconnect token+secret"
	case AuthTypeNone:
		return "No saved credentials"
	default:
		return string(auth)
	}
}
