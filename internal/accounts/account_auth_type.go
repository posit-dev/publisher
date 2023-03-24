package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountAuthType string

const (
	AuthTypeNone        AccountAuthType = "none"         // No saved credentials
	AuthTypeAPIKey      AccountAuthType = "api-key"      // Connect API key
	AuthTypeTokenKey    AccountAuthType = "token-key"    // rsconnect token & private key (Connect)
	AuthTypeTokenSecret AccountAuthType = "token-secret" // rsconnect token & secret (Cloud, shinyapps.io)
)

var authTypeDescriptions = map[AccountAuthType]string{
	AuthTypeNone:        "No saved credentials",
	AuthTypeAPIKey:      "Connect API key",
	AuthTypeTokenKey:    "RStudio IDE/rsconnect token+key",
	AuthTypeTokenSecret: "RStudio IDE/rsconnect token+secret",
}

func (auth AccountAuthType) Description() string {
	if desc, ok := authTypeDescriptions[auth]; ok {
		return desc
	}
	return string(auth)
}
