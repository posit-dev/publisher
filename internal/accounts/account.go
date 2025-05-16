package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type Account struct {
	ServerType          ServerType    `json:"type"`         // Which type of API this server provides
	Source              AccountSource `json:"source"`       // Source of the saved server configuration
	Name                string        `json:"name"`         // Nickname
	URL                 string        `json:"url"`          // Server URL, e.g. https://connect.example.com/rsc
	Insecure            bool          `json:"insecure"`     // Skip https server verification
	Certificate         string        `json:"-"`            // Root CA certificate, if server cert is signed by a private CA
	AccountName         string        `json:"account_name"` // Username, if known
	ApiKey              string        `json:"-"`            // For Connect servers
	SnowflakeConnection string        `json:"-"`
}

// AuthType returns the detected AccountAuthType based on the properties of the
// Account.
func (acct *Account) AuthType() AccountAuthType {
	// an account should have either an API key or a Snowflake connection name, never both.
	if acct.ApiKey != "" {
		return AuthTypeAPIKey
	} else if acct.SnowflakeConnection != "" {
		return AuthTypeSnowflake
	}
	return AuthTypeNone
}

// HasCredential returns true if the Account is configured with an API Key or
// Snowflake connection name, i.e. if it ought to be able to authenticate.
func (acct *Account) HasCredential() bool {
	return acct.ApiKey != "" || acct.SnowflakeConnection != ""
}
