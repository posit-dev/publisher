package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type PublishCommandSuite struct {
	utiltest.Suite
}

func TestPublishCommandSuite(t *testing.T) {
	suite.Run(t, new(PublishCommandSuite))
}

func (s *PublishCommandSuite) TestGetDefaultAccountEmpty() {
	acct, err := getDefaultAccount([]accounts.Account{})
	s.ErrorIs(err, errNoAccounts)
	s.Nil(acct)
}

func (s *PublishCommandSuite) TestGetDefaultAccountOne() {
	acct, err := getDefaultAccount([]accounts.Account{
		{Name: "abc"},
	})
	s.NoError(err)
	s.Equal("abc", acct.Name)
}

func (s *PublishCommandSuite) TestGetDefaultAccountMultiple() {
	acct, err := getDefaultAccount([]accounts.Account{
		{Name: "def"},
		{Name: "abc"},
	})
	s.NoError(err)
	s.Equal("abc", acct.Name)
}
