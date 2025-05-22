package accounts

// Copyright (C) 2023 by Posit Software, PBC.

type AccountAuthType string

const (
	AuthTypeNone      AccountAuthType = "none"    // No saved credentials
	AuthTypeAPIKey    AccountAuthType = "api-key" // Connect API key
	AuthTypeSnowflake AccountAuthType = "snowflake"
)

var authTypeDescriptions = map[AccountAuthType]string{
	AuthTypeNone:      "No saved credentials",
	AuthTypeAPIKey:    "Connect API key",
	AuthTypeSnowflake: "Snowflake",
}

func (auth AccountAuthType) Description() string {
	if desc, ok := authTypeDescriptions[auth]; ok {
		return desc
	}
	return string(auth)
}
