package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type AccountSuite struct {
	utiltest.Suite
}

func TestAccountSuite(t *testing.T) {
	suite.Run(t, new(AccountSuite))
}

func (s *AccountSuite) TestAuthTypeNone() {
	account := Account{}
	auth := account.AuthType()
	s.Equal(AuthTypeNone, auth)
}

func (s *AccountSuite) TestAuthTypeApiKey() {
	account := Account{
		ApiKey: "abc",
	}
	auth := account.AuthType()
	s.Equal(AuthTypeAPIKey, auth)
}

func (s *AccountSuite) TestAuthTypeSnowflake() {
	account := Account{
		SnowflakeConnection: "default",
	}
	auth := account.AuthType()
	s.Equal(AuthTypeSnowflake, auth)
}

func (s *AccountSuite) TestAuthTypeToken() {
	account := Account{
		Token:      "T123456789",
		PrivateKey: "base64-encoded-private-key",
	}
	auth := account.AuthType()
	s.Equal(AuthTypeToken, auth)
}

func (s *AccountSuite) TestAuthTypeTokenWithMissingFields() {
	// Missing private key
	account := Account{
		Token: "T123456789",
	}
	auth := account.AuthType()
	s.Equal(AuthTypeNone, auth)

	// Missing token
	account = Account{
		PrivateKey: "base64-encoded-private-key",
	}
	auth = account.AuthType()
	s.Equal(AuthTypeNone, auth)
}

func (s *AccountSuite) TestAuthTypePrecedence() {
	// API key has precedence over token
	account := Account{
		ApiKey:     "abc",
		Token:      "T123456789",
		PrivateKey: "base64-encoded-private-key",
	}
	auth := account.AuthType()
	s.Equal(AuthTypeAPIKey, auth)

	// Snowflake connection has precedence over token
	account = Account{
		SnowflakeConnection: "default",
		Token:               "T123456789",
		PrivateKey:          "base64-encoded-private-key",
	}
	auth = account.AuthType()
	s.Equal(AuthTypeSnowflake, auth)
}

func (s *AccountSuite) TestHasCredential() {
	account := Account{
		ApiKey:              "abc",
		SnowflakeConnection: "default",
	}
	s.True(account.HasCredential())
	account.ApiKey = ""
	s.True(account.HasCredential())
	account.SnowflakeConnection = ""
	s.False(account.HasCredential())

	// Test token credentials
	account.Token = "T123456789"
	account.PrivateKey = "base64-encoded-private-key"
	s.True(account.HasCredential())

	// Test with only token (missing private key)
	account.PrivateKey = ""
	s.False(account.HasCredential())

	// Test with only private key (missing token)
	account.Token = ""
	account.PrivateKey = "base64-encoded-private-key"
	s.False(account.HasCredential())
}
