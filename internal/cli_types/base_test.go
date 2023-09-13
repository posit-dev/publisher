package cli_types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/publishing-client/internal/accounts"
	"github.com/rstudio/publishing-client/internal/logging"
	"github.com/rstudio/publishing-client/internal/services"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
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
	token := services.LocalToken("abc123")
	fs := utiltest.NewMockFs()
	log := logging.New()

	ctx := NewCLIContext(accountList, token, fs, log)
	s.Equal(accountList, ctx.Accounts)
	s.Equal(token, ctx.LocalToken)
	s.Equal(log, ctx.Logger)
	accountList.AssertNotCalled(s.T(), "GetAllAccounts")
}
