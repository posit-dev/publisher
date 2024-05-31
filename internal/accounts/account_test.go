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

func (s *AccountSuite) TestInferAuthTypeNone() {
	account := Account{}
	auth := account.InferAuthType()
	s.Equal(AuthTypeNone, auth)
}

func (s *AccountSuite) TestInferAuthTypeApiKey() {
	account := Account{
		ApiKey: "abc",
	}
	auth := account.InferAuthType()
	s.Equal(AuthTypeAPIKey, auth)
}
