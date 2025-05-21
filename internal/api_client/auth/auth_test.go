package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type AuthSuite struct {
	utiltest.Suite
}

func TestAuthSuite(t *testing.T) {
	suite.Run(t, new(AuthSuite))
}

func (s *AuthSuite) TestNewClientAuth() {
	auth, err := NewClientAuth(&accounts.Account{})
	s.NoError(err)
	s.Equal(&nullAuthenticator{}, auth)

	auth, err = NewClientAuth(&accounts.Account{
		ApiKey: ":key:",
	})
	s.NoError(err)
	s.Equal(&apiKeyAuthenticator{
		apiKey:     ":key:",
		headerName: "Authorization",
	}, auth)

	_, err = NewClientAuth(&accounts.Account{
		SnowflakeConnection: ":snow:",
	})
	s.ErrorContains(err, "connection :snow: not found")
	// This is enough to prove we tried to build a snowflake authenticator
	// and passed in the right connection name.
	// Potential improvement: move DI of snowflake helpers further up the
	// call chain, use mocks here.
}
