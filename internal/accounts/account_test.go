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
