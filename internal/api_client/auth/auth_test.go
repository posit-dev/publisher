package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
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
	af := NewAuthFactory()
	auth, err := af.NewClientAuth(&accounts.Account{})
	s.NoError(err)
	s.Equal(&nullAuthenticator{}, auth)

	auth, err = af.NewClientAuth(&accounts.Account{
		ApiKey: ":key:",
	})
	s.NoError(err)
	s.Equal(&apiKeyAuthenticator{
		apiKey:     ":key:",
		headerName: "Authorization",
	}, auth)

	connections := &snowflake.MockConnections{}
	connections.On("Get", ":snow:").Return(&snowflake.Connection{}, errors.New("test-error"))
	af.connections = connections
	_, err = af.NewClientAuth(&accounts.Account{
		SnowflakeConnection: ":snow:",
	})
	s.ErrorContains(err, "test-error")
	// Proves we called the snowflake auth constructor with the connection
	// name, without having to set up everything else. See
	// snowflake_test.go for full constructor tests.
}
