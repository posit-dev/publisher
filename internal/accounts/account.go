package accounts

import "strings"

// Copyright (C) 2023 by Posit Software, PBC.

type Account struct {
	ServerType  ServerType    `json:"type"`         // Which type of API this server provides
	Source      AccountSource `json:"source"`       // Source of the saved server configuration
	Name        string        `json:"name"`         // Nickname
	URL         string        `json:"url"`          // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool          `json:"insecure"`     // Skip https server verification
	Certificate string        `json:"-"`            // Root CA certificate, if server cert is signed by a private CA
	AccountName string        `json:"account_name"` // Username, if known
	ApiKey      string        `json:"-"`            // For Connect servers
}

func (acct *Account) AuthType() AccountAuthType {
	// connect API key cannot be used in snowflake, only snowflake auth
	if strings.Contains(acct.URL, "snowflakecomputing.app") {
		return AuthTypeSnowflake
	}
	if acct.ApiKey != "" {
		return AuthTypeAPIKey
	}
	return AuthTypeNone
}
