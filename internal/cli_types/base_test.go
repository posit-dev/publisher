package cli_types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type CLIContextSuite struct {
	utiltest.Suite
}

func TestCLIContextSuite(t *testing.T) {
	suite.Run(t, new(CLIContextSuite))
}

func (s *CLIContextSuite) TestNewCLIContext() {
	accountList := &accounts.MockAccountList{}
	fs := utiltest.NewMockFs()
	log := logging.New()

	ctx := NewCLIContext(accountList, fs, log)
	s.Equal(accountList, ctx.Accounts)
	s.Equal(log, ctx.Logger)
	accountList.AssertNotCalled(s.T(), "GetAllAccounts")
}
