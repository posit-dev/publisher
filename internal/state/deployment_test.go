package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type DeploymentSuite struct {
	utiltest.Suite
}

func TestDeploymentSuite(t *testing.T) {
	suite.Run(t, new(DeploymentSuite))
}

func (s *DeploymentSuite) TestGetDefaultAccountEmpty() {
	acct, err := getDefaultAccount([]accounts.Account{})
	s.ErrorIs(err, errNoAccounts)
	s.Nil(acct)
}

func (s *DeploymentSuite) TestGetDefaultAccountOne() {
	acct, err := getDefaultAccount([]accounts.Account{
		{Name: "abc"},
	})
	s.NoError(err)
	s.Equal("abc", acct.Name)
}

func (s *DeploymentSuite) TestGetDefaultAccountMultiple() {
	acct, err := getDefaultAccount([]accounts.Account{
		{Name: "def"},
		{Name: "abc"},
	})
	s.NoError(err)
	s.Equal("abc", acct.Name)
}
