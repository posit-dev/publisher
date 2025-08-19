package accounts

import (
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"
)

// Copyright (C) 2023 by Posit Software, PBC.

type Account struct {
	ServerType          server_type.ServerType `json:"type"`               // Which type of API this server provides
	Source              AccountSource          `json:"source"`             // Source of the saved server configuration
	Name                string                 `json:"name"`               // Nickname
	URL                 string                 `json:"url"`                // Server URL, e.g. https://connect.example.com/rsc
	Insecure            bool                   `json:"insecure"`           // Skip https server verification
	Certificate         string                 `json:"-"`                  // Root CA certificate, if server cert is signed by a private CA
	AccountName         string                 `json:"account_name"`       // Username, if known
	ApiKey              string                 `json:"-"`                  // For Connect servers
	SnowflakeConnection string                 `json:"-"`                  // Snowflake connection name used instead of API Key in SPCS
	CloudEnvironment    types.CloudEnvironment `json:"cloud_environment"`  // Environment for Connect Cloud (production, staging, development)
	CloudAccountID      string                 `json:"cloud_account_id"`   // Account ID for Connect Cloud
	CloudAccountName    string                 `json:"cloud_account_name"` // Account name for Connect Cloud
	CloudAccessToken    types.CloudAuthToken   `json:"-"`                  // Access token for OAuth authentication
	CloudRefreshToken   string                 `json:"-"`                  // Refresh token for OAuth authentication
	Token               string                 `json:"-"`                  // Token ID for token-based authentication
	PrivateKey          string                 `json:"-"`                  // Base64-encoded private key for signing requests
}

// AuthType returns the detected AccountAuthType based on the properties of the
// Account.
func (acct *Account) AuthType() AccountAuthType {
	// An account should have one of: API key, Snowflake connection name, or token+private key
	if acct.ApiKey != "" {
		return AuthTypeAPIKey
	} else if acct.SnowflakeConnection != "" {
		return AuthTypeSnowflake
	} else if acct.Token != "" && acct.PrivateKey != "" {
		return AuthTypeToken
	}
	return AuthTypeNone
}

// HasCredential returns true if the Account is configured with valid credentials
// for authentication.
func (acct *Account) HasCredential() bool {
	return acct.ApiKey != "" ||
		acct.SnowflakeConnection != "" ||
		(acct.Token != "" && acct.PrivateKey != "")
}
